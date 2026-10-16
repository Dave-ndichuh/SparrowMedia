from django.urls import path
from agents.views import AgentEditView

urlpatterns = [
    path("edit/", AgentEditView.as_view(), name="agent-edit"),
]
