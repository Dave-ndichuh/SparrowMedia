from django.urls import path
from assets.views import AssetUploadView, AssetSearchView, AssetListView, AssetDetailView

urlpatterns = [
    path("", AssetListView.as_view(), name="asset-list"),
    path("upload/", AssetUploadView.as_view(), name="asset-upload"),
    path("search/", AssetSearchView.as_view(), name="asset-search"),
    path("<uuid:pk>/", AssetDetailView.as_view(), name="asset-detail"),
]
