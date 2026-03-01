import smtplib
import secrets
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def generate_verify_token() -> str:
    """Generate a secure one-time token for email verification."""
    return secrets.token_urlsafe(32)


def send_verification_email(to_email: str, username: str, token: str, base_url: str = None) -> bool:
    """
    Send email verification link to user.
    Returns True if sent successfully, False otherwise (dev mode or error).
    """
    verify_url = f"{base_url or 'http://localhost:5173'}/verify-email?token={token}"

    smtp_user = settings.SMTP_USER or os.environ.get("SMTP_USER", "")
    smtp_pass = settings.SMTP_PASSWORD or os.environ.get("SMTP_PASSWORD", "")

    # ── Dev mode: SMTP not configured ───────────────────────────────────
    if not smtp_user or not smtp_pass:
        logger.info(
            f"DEV MODE — Email not sent (configure SMTP_USER + SMTP_PASSWORD in .env)\n"
            f"  Token for {to_email}: {token}\n"
            f"  Verify URL: {verify_url}"
        )
        return False

    # ── Send real email ──────────────────────────────────────────────────
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verifiez votre email - DAILFOW"
        msg["From"] = settings.EMAIL_FROM or smtp_user
        msg["To"] = to_email

        html = f"""
        <html><body style="font-family:sans-serif;background:#0F172A;color:#F1F5F9;padding:40px">
          <div style="max-width:480px;margin:0 auto;background:#1E293B;border-radius:16px;padding:32px;border:1px solid #334155">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-size:24px;font-weight:700;color:#6366F1">DAILFOW</span>
            </div>
            <h2 style="font-size:18px;margin-bottom:8px">Bonjour {username}</h2>
            <p style="color:#94A3B8;margin-bottom:24px">
              Cliquez sur le bouton ci-dessous pour verifier votre adresse email et activer votre compte.
            </p>
            <a href="{verify_url}"
               style="display:block;background:#6366F1;color:white;
                      text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;
                      font-weight:600;font-size:15px">
              Verifier mon email
            </a>
            <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px">
              Ce lien expire dans 24 heures.
            </p>
          </div>
        </body></html>
        """

        msg.attach(MIMEText(html, "html"))

        smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
        smtp_port = settings.SMTP_PORT or 587

        logger.info(f"Connecting to SMTP {smtp_host}:{smtp_port} as {smtp_user}")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(msg["From"], to_email, msg.as_string())

        logger.info(f"Verification email sent to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP auth failed for {smtp_user}: {e} — check SMTP_USER/SMTP_PASSWORD in .env")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email to {to_email}: {e}")
        return False
