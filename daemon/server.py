"""
Sparrow Media Group - Local Hardware Daemon Server
Hosts WebRTC signaling (HTTP/WebSocket) on 127.0.0.1:8765 to bridge
physical HDMI/USB capture devices directly to Next.js studio frontend.
"""

import os
import sys
import time
import json
import logging
import asyncio
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer

from daemon.device_scanner import scan_devices
from daemon.streamer import OpenCVVideoStreamTrack
from daemon.rtmp_pusher import start_broadcast, stop_broadcast, get_broadcast_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
)
logger = logging.getLogger("sparrow.daemon")

START_TIME = time.time()
PORT = 8765
HOST = "127.0.0.1"

# Track active peer connections for clean lifecycle management
active_peer_connections = set()


@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=200)
    else:
        try:
            response = await handler(request)
        except web.HTTPException as ex:
            response = ex

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


async def handle_health(request: web.Request) -> web.Response:
    """Quick liveness and telemetry endpoint."""
    uptime = int(time.time() - START_TIME)
    return web.json_response({
        "status": "online",
        "service": "sparrow-hardware-daemon",
        "version": "0.1.0",
        "uptime_seconds": uptime,
        "active_peers": len(active_peer_connections),
    })


async def handle_devices(request: web.Request) -> web.Response:
    """Return all detected video capture devices."""
    loop = asyncio.get_running_loop()
    devices = await loop.run_in_executor(None, scan_devices)
    return web.json_response({"devices": devices})


async def handle_broadcast_start(request: web.Request) -> web.Response:
    """Start on-air broadcast or local recording sink."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    destination = data.get("destination", "local_sink")
    rtmp_url = data.get("rtmp_url", None)
    res = start_broadcast(destination=destination, rtmp_url=rtmp_url)
    return web.json_response(res)


async def handle_broadcast_stop(request: web.Request) -> web.Response:
    """Stop active on-air broadcast or recording sink."""
    res = stop_broadcast()
    return web.json_response(res)


async def handle_broadcast_status(request: web.Request) -> web.Response:
    """Get real-time telemetry of current broadcast session."""
    res = get_broadcast_status()
    return web.json_response(res)


async def handle_offer(request: web.Request) -> web.Response:
    """
    WebRTC SDP offer/answer exchange endpoint.
    Takes browser's WebRTC offer and replies with local track answer.
    """
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    video_device_index = params.get("video_device_index", 0)
    width = params.get("width", 1920)
    height = params.get("height", 1080)
    fps = params.get("fps", 30)

    logger.info(f"Received WebRTC offer for device {video_device_index} ({width}x{height}@{fps}fps)")

    # Standard local peer connection (no external STUN needed for localhost loopback)
    pc = RTCPeerConnection()
    active_peer_connections.add(pc)

    # Instantiate hardware capture track
    video_track = OpenCVVideoStreamTrack(
        device_index=video_device_index,
        width=width,
        height=height,
        fps=fps,
    )
    pc.addTrack(video_track)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logger.info(f"PeerConnection state changed to: {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            video_track.stop()
            active_peer_connections.discard(pc)
            await pc.close()

    # Complete WebRTC handshake
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    logger.info("Successfully established local WebRTC peer handshake")
    return web.json_response({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    })


async def handle_ws(request: web.Request) -> web.WebSocketResponse:
    """WebSocket for real-time status and telemetry."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    logger.info("Studio client connected to status WebSocket")
    try:
        while not ws.closed:
            status_payload = {
                "type": "heartbeat",
                "uptime": int(time.time() - START_TIME),
                "activePeers": len(active_peer_connections),
                "timestamp": time.time(),
                "broadcast": get_broadcast_status(),
            }
            await ws.send_json(status_payload)
            await asyncio.sleep(2)
    except Exception as ex:
        logger.debug(f"WebSocket client disconnected: {ex}")
    finally:
        logger.info("Studio client disconnected from status WebSocket")

    return ws


async def on_shutdown(app: web.Application):
    """Close all open peer connections and stop active broadcasts when daemon stops."""
    logger.info("Stopping any active broadcast session...")
    stop_broadcast()
    logger.info("Closing active peer connections...")
    coros = [pc.close() for pc in active_peer_connections]
    await asyncio.gather(*coros, return_exceptions=True)
    active_peer_connections.clear()


def create_app() -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get("/", handle_health)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/devices", handle_devices)
    app.router.add_post("/offer", handle_offer)
    app.router.add_post("/broadcast/start", handle_broadcast_start)
    app.router.add_post("/broadcast/stop", handle_broadcast_stop)
    app.router.add_get("/broadcast/status", handle_broadcast_status)
    app.router.add_get("/ws", handle_ws)
    app.on_shutdown.append(on_shutdown)
    return app


def main():
    print("=" * 60)
    print("  SPARROW MEDIA GROUP // LOCAL HARDWARE DAEMON")
    print(f"  Listening on: http://{HOST}:{PORT}")
    print("=" * 60)
    app = create_app()
    web.run_app(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
