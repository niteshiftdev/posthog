from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth import login
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseRedirect
from django.utils.http import url_has_allowed_host_and_scheme

from posthog.event_usage import report_user_logged_in
from posthog.models import User

DEFAULT_DEV_LOGIN_EMAIL = "test@posthog.com"
_AUTH_WALL_PATHS = frozenset({"/login", "/signup", "/reset", "/verify_email", "/unsubscribe"})


def is_dev_login_allowed() -> bool:
    return settings.DEBUG and settings.ALLOW_DEV_LOGIN


def perform_magic_dev_login(request: HttpRequest) -> HttpResponse:
    if not is_dev_login_allowed():
        raise Http404()

    email = (request.GET.get("email") or DEFAULT_DEV_LOGIN_EMAIL).strip()
    user = User.objects.filter(email__iexact=email, is_active=True).order_by("pk").first()
    if user is None:
        raise Http404()

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["reauth"] = "false"
    request.session.save()
    report_user_logged_in(user, social_provider="")

    return HttpResponseRedirect(_safe_return_to(request))


def _safe_return_to(request: HttpRequest) -> str:
    next_url = request.GET.get("returnTo") or "/"
    if not url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        return "/"
    path = urlparse(next_url).path.rstrip("/") or "/"
    if path in _AUTH_WALL_PATHS or any(path.startswith(f"{wall}/") for wall in _AUTH_WALL_PATHS):
        return "/"
    return next_url
