import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { MuiTelInput, matchIsValidTel } from "mui-tel-input";
import { ApiError, api, errorCode } from "../lib/api";
import { createCodeChallenge, generateCodeVerifier, setSession } from "../lib/auth";
import { Language, t } from "../lib/i18n";
import { countryOptions } from "../lib/countries";
import { PRIVACY_POLICY_VERSION } from "../lib/privacyNotice";
import { safeNextPath } from "../lib/redirect";
import { isValidUsername } from "../lib/username";
import useToast from "../components/useToast";
import { ActionButton, TipIconButton } from "../components/ActionButton";
import TurnstileWidget, { TurnstileHandle } from "../components/TurnstileWidget";

interface LoginProps {
  language: Language;
}

type AuthTab = "login" | "signup";
type RegistrationStatus = "open" | "openday" | "closed";
type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number; expires_in?: number };

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

type SignupForm = {
  email: string;
  username: string;
  password: string;
  confirm: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  emergencyContactName: string;
  emergencyContact: string;
  privacy: boolean;
};

const EMPTY_SIGNUP: SignupForm = {
  email: "", username: "", password: "", confirm: "", firstName: "", lastName: "", phone: "", country: "IT",
  city: "", address: "", emergencyContactName: "", emergencyContact: "", privacy: false
};

type Errors = Partial<Record<keyof SignupForm, string>>;

export default function Login({ language }: LoginProps) {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  // Protected pages send the user here with ?next=<original path>; only in-app paths are honoured.
  const nextPath = safeNextPath(searchParams.get("next")) ?? "/";
  const toast = useToast();
  const tr = (key: string) => t(language, key as any);
  const [tab, setTab] = useState<AuthTab>("login");
  const [busy, setBusy] = useState(false);
  // Manual opening/closing of registrations (GET /public/registration). Sign in always stays available.
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("open");
  // Cloudflare Turnstile is required on sign-up only when the backend publishes a site key.
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    void loadRegistration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRegistration() {
    try {
      const res = await api<{ status?: RegistrationStatus; defaultPage?: string; turnstileSiteKey?: string | null }>("/public/registration");
      if (res?.status) setRegistrationStatus(res.status);
      if (res?.defaultPage === "register") setTab("signup");
      setTurnstileSiteKey(res?.turnstileSiteKey || null);
    } catch {
      // Keep the defaults: registrations open, sign-in tab first.
    }
  }

  // --- Login ---
  // The field takes the email or the username: only values with "@" are checked as emails.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // --- Signup ---
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SignupForm>(EMPTY_SIGNUP);
  const [errors, setErrors] = useState<Errors>({});
  const countries = useMemo(() => countryOptions(language), [language]);
  const steps = [tr("signupStepAccount"), tr("signupStepPersonal"), tr("signupStepConfirm")];

  function emailProblem(value: string): string {
    if (value.length > 254) return tr("emailValidationTooLong");
    if (value && !EMAIL_RE.test(value)) return tr("emailValidationInvalid");
    return "";
  }

  function identifierProblem(value: string): string {
    return value.includes("@") ? emailProblem(value) : "";
  }

  function handleError(error: unknown) {
    console.error(error);
    toast.error(error instanceof Error && error.message ? error.message : tr("errorGeneric"));
  }

  async function signIn(userEmail: string, userPassword: string) {
    try {
      const tokenRes = await api<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, password: userPassword })
      });
      setSession(tokenRes.accessToken, tokenRes.refreshToken, tokenRes.expiresIn ?? tokenRes.expires_in ?? 0);
      return;
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) throw error;
    }
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const authRes = await api<{ code: string }>("/auth/authorize", {
      method: "POST",
      body: JSON.stringify({ email: userEmail, password: userPassword, code_challenge: codeChallenge, code_challenge_method: "S256" })
    });
    const tokenRes = await api<TokenResponse>("/auth/token", {
      method: "POST",
      body: JSON.stringify({ code: authRes.code, code_verifier: codeVerifier })
    });
    setSession(tokenRes.accessToken, tokenRes.refreshToken, tokenRes.expiresIn ?? tokenRes.expires_in ?? 0);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    const problem = identifierProblem(email.trim());
    setEmailError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await signIn(email, password);
      nav(nextPath);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof SignupForm>(key: K, value: SignupForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateStep(index: number): boolean {
    const next: Errors = {};
    const required = tr("signupRequired");
    if (index === 0) {
      if (!form.email.trim()) next.email = required;
      else if (emailProblem(form.email.trim())) next.email = emailProblem(form.email.trim());
      if (form.username.trim() && !isValidUsername(form.username.trim())) next.username = tr("usernameInvalid");
      if (form.password.length < MIN_PASSWORD) next.password = tr("signupPasswordShort");
      if (form.confirm !== form.password) next.confirm = tr("signupPasswordMismatch");
    }
    if (index === 1) {
      if (!form.firstName.trim()) next.firstName = required;
      if (!form.lastName.trim()) next.lastName = required;
      if (!form.phone.trim() || !matchIsValidTel(form.phone)) next.phone = form.phone.trim() ? tr("profilePhoneError") : required;
      if (!form.country) next.country = required;
      if (!form.city.trim()) next.city = required;
    }
    if (index === 2) {
      if (form.emergencyContact.trim() && !matchIsValidTel(form.emergencyContact)) next.emergencyContact = tr("profilePhoneError");
      if (!form.privacy) next.privacy = tr("signupPrivacyRequired");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (step < steps.length - 1) { goNext(); return; }
    if (!validateStep(step)) return;
    const userEmail = form.email.trim();
    const username = form.username.trim();
    setBusy(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          ...(username ? { username } : {}),
          password: form.password,
          privacyAccepted: true,
          privacyVersion: PRIVACY_POLICY_VERSION,
          ...(turnstileSiteKey ? { turnstileToken } : {})
        })
      });
      await signIn(userEmail, form.password);
    } catch (err) {
      // Turnstile tokens are single use: any failed attempt needs a fresh challenge.
      turnstileRef.current?.reset();
      if (errorCode(err) === "REGISTRATION_CLOSED") setRegistrationStatus("closed");
      else if (errorCode(err) === "USERNAME_TAKEN") {
        setErrors({ username: tr("usernameTaken") });
        setStep(0);
      } else if (errorCode(err) === "CAPTCHA_FAILED") toast.error(tr("captchaFailed"));
      else handleError(err);
      setBusy(false);
      return;
    }
    const optional = (v: string) => (v.trim() ? v.trim() : undefined);
    try {
      await api("/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          country: form.country,
          city: form.city.trim(),
          address: optional(form.address),
          emergencyContactName: optional(form.emergencyContactName),
          emergencyContact: optional(form.emergencyContact)
        })
      });
      nav(nextPath);
    } catch {
      // The account exists and the session is open: let the user finish the profile there.
      toast.error(tr("signupProfileSaveError"));
      nav("/profile");
    } finally {
      setBusy(false);
    }
  }

  const passwordAdornment = (
    <InputAdornment position="end">
      <TipIconButton
        tip={tr("tipShowPassword")}
        aria-label={tr(showPassword ? "signupHidePassword" : "signupShowPassword")}
        onClick={() => setShowPassword((v) => !v)}
        edge="end"
        size="small"
      >
        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </TipIconButton>
    </InputAdornment>
  );

  const countryLabel = countries.find((c) => c.code === form.country)?.name ?? form.country;

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", px: 2, py: { xs: 3, sm: 6 } }}>
      {toast.node}
      <Paper variant="outlined" sx={{ width: "100%", maxWidth: tab === "signup" ? 560 : 420, p: { xs: 3, sm: 4 }, borderRadius: 3, transition: "max-width .2s" }}>
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
              Monte San Savino Show
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {tr(tab === "login" ? "authLoginTitle" : "authSignupTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {tr(tab === "login" ? "authLoginSubtitle" : "authSignupSubtitle")}
            </Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v: AuthTab) => { setTab(v); setErrors({}); }}
            variant="fullWidth"
            aria-label={tr("authTabsLabel")}
            TabIndicatorProps={{ sx: { display: "none" } }}
            sx={{
              minHeight: 0,
              border: 1,
              borderColor: "primary.main",
              borderRadius: 999,
              p: 0.5,
              "& .MuiTab-root": {
                minHeight: 0,
                py: 1,
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: "primary.main",
                transition: "background-color .15s, color .15s"
              },
              "& .MuiTab-root.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText" }
            }}
          >
            <Tab value="login" label={tr("authTabLogin")} data-tour="login-tab" />
            <Tab value="signup" label={tr("authTabSignup")} data-tour="login-signup" />
          </Tabs>

          {tab === "login" ? (
            <Stack data-tour="login-form" component="form" spacing={2} onSubmit={onLogin} noValidate>
              <TextField
                label={tr("loginIdentifierLabel")}
                type="text"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError(identifierProblem(event.target.value.trim()));
                }}
                onBlur={() => setEmailError(identifierProblem(email.trim()))}
                error={!!emailError}
                helperText={emailError}
                fullWidth
              />
              <TextField
                label={tr("passwordLabel")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                InputProps={{ endAdornment: passwordAdornment }}
                fullWidth
              />
              <ActionButton
                tip={tr("tipLogin")}
                data-tour="login-submit"
                type="submit"
                variant="contained"
                size="large"
                disabled={busy || !email || !password}
                fullWidth
              >
                {tr("loginButton")}
              </ActionButton>
              <Box textAlign="center">
                <ActionButton
                  tip={tr("tipForgotPassword")}
                  variant="text"
                  size="small"
                  onClick={() => setForgotOpen(true)}
                >
                  {tr("forgotPasswordLink")}
                </ActionButton>
              </Box>
            </Stack>
          ) : registrationStatus === "closed" ? (
            <Stack spacing={2} data-testid="registration-closed">
              <Alert severity="info">{tr("registrationClosed")}</Alert>
              <Typography variant="body2" color="text.secondary" textAlign="center">{tr("authRegistrationClosedHelp")}</Typography>
            </Stack>
          ) : (
            <Stack component="form" spacing={3} onSubmit={onSignup} noValidate data-tour="signup-form">
              <Stepper activeStep={step} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}><StepLabel>{label}</StepLabel></Step>
                ))}
              </Stepper>

              {step === 0 && (
                <Stack spacing={2}>
                  <TextField
                    label={`${tr("emailLabel")} *`}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => form.email && setErrors((x) => ({ ...x, email: emailProblem(form.email.trim()) || undefined }))}
                    error={!!errors.email}
                    helperText={errors.email ?? tr("signupEmailHelp")}
                    fullWidth
                  />
                  <TextField
                    label={tr("usernameLabel")}
                    autoComplete="username"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    error={!!errors.username}
                    helperText={errors.username ?? tr("usernameHelp")}
                    fullWidth
                  />
                  <TextField
                    label={`${tr("passwordLabel")} *`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    error={!!errors.password}
                    helperText={errors.password ?? tr("signupPasswordHint")}
                    InputProps={{ endAdornment: passwordAdornment }}
                    fullWidth
                  />
                  <TextField
                    label={`${tr("signupPasswordConfirm")} *`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                    error={!!errors.confirm}
                    helperText={errors.confirm ?? " "}
                    fullWidth
                  />
                </Stack>
              )}

              {step === 1 && (
                <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField label={`${tr("profileFirstName")} *`} autoComplete="given-name" autoFocus value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)} error={!!errors.firstName} helperText={errors.firstName} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label={`${tr("profileLastName")} *`} autoComplete="family-name" value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)} error={!!errors.lastName} helperText={errors.lastName} fullWidth />
                  </Grid>
                  <Grid item xs={12}>
                    <MuiTelInput label={`${tr("profilePhone")} *`} defaultCountry="IT" value={form.phone}
                      onChange={(v) => set("phone", v)} error={!!errors.phone} helperText={errors.phone ?? tr("signupPhoneHelp")} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField select label={`${tr("signupCountry")} *`} autoComplete="country" value={form.country}
                      onChange={(e) => set("country", e.target.value)} error={!!errors.country} helperText={errors.country} fullWidth>
                      {countries.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label={`${tr("signupCity")} *`} autoComplete="address-level2" value={form.city}
                      onChange={(e) => set("city", e.target.value)} error={!!errors.city} helperText={errors.city} fullWidth />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label={tr("signupAddressOptional")} autoComplete="street-address" value={form.address}
                      onChange={(e) => set("address", e.target.value)} fullWidth />
                  </Grid>
                </Grid>
                </Box>
              )}

              {step === 2 && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2">{tr("signupEmergencyTitle")}</Typography>
                    <Typography variant="body2" color="text.secondary">{tr("signupEmergencyHelp")}</Typography>
                  </Box>
                  <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField label={tr("profileEmergencyName")} value={form.emergencyContactName}
                        onChange={(e) => set("emergencyContactName", e.target.value)} fullWidth />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <MuiTelInput label={tr("profileEmergencyContact")} defaultCountry="IT" value={form.emergencyContact}
                        onChange={(v) => set("emergencyContact", v)} error={!!errors.emergencyContact} helperText={errors.emergencyContact} fullWidth />
                    </Grid>
                  </Grid>
                  </Box>
                  <Divider />
                  <Box data-testid="signup-summary">
                    <Typography variant="subtitle2" gutterBottom>{tr("signupSummary")}</Typography>
                    <Typography variant="body2">{form.firstName} {form.lastName} · {form.email}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {form.phone} · {[form.address, form.city, countryLabel].filter((v) => v && v.trim()).join(", ")}
                    </Typography>
                  </Box>
                  <Box>
                    <FormControlLabel
                      control={<Checkbox checked={form.privacy} onChange={(e) => set("privacy", e.target.checked)} />}
                      label={<Typography variant="body2">{tr("signupPrivacy")}</Typography>}
                    />
                    <Box sx={{ pl: 4 }}>
                      <Link href="/privacy" target="_blank" rel="noopener" variant="body2">{tr("signupPrivacyLink")}</Link>
                    </Box>
                    {errors.privacy && <FormHelperText error>{errors.privacy}</FormHelperText>}
                  </Box>
                  {turnstileSiteKey && (
                    <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
                  )}
                </Stack>
              )}

              {step === 0 && (
                <Alert severity="info" variant="outlined" sx={{ py: 0 }}>{tr("signupStepsInfo")}</Alert>
              )}

              <Stack direction="row" spacing={2}>
                {step > 0 && (
                  <ActionButton tip={tr("tipSignupBack")} type="button" variant="outlined" size="large" onClick={() => { setErrors({}); setStep((s) => s - 1); }} disabled={busy} wrapperSx={{ flex: 1 }} fullWidth>
                    {tr("signupBack")}
                  </ActionButton>
                )}
                {step < steps.length - 1 ? (
                  <ActionButton tip={tr("tipSignupNext")} type="submit" variant="contained" size="large" disabled={busy} wrapperSx={{ flex: 1 }} fullWidth>
                    {tr("signupNext")}
                  </ActionButton>
                ) : (
                  <ActionButton tip={tr("tipSignup")} type="submit" variant="contained" size="large" disabled={busy || (!!turnstileSiteKey && !turnstileToken)} wrapperSx={{ flex: 1 }} fullWidth>
                    {tr("signupButton")}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
          )}
          {/* Outside the sign-in form: a dialog's submit would otherwise bubble to the form's onSubmit. */}
          <ForgotPasswordDialog
            language={language}
            open={forgotOpen}
            defaultEmail={email.includes("@") ? email.trim() : ""}
            onClose={() => setForgotOpen(false)}
          />
        </Stack>
      </Paper>
    </Box>
  );
}

interface ForgotPasswordDialogProps {
  language: Language;
  open: boolean;
  defaultEmail: string;
  onClose: () => void;
}

// Always answers with the same generic confirmation: it does not reveal whether the email is registered.
function ForgotPasswordDialog({ language, open, defaultEmail, onClose }: ForgotPasswordDialogProps) {
  const tr = (key: string) => t(language, key as any);
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setProblem("");
    setSent(false);
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || value.length > 254 || !EMAIL_RE.test(value)) {
      setProblem(tr(value ? "emailValidationInvalid" : "signupRequired"));
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: value }) });
      setSent(true);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{tr("forgotPasswordTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {sent ? (
              <Alert severity="info">{tr("forgotPasswordSent")}</Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">{tr("forgotPasswordHelp")}</Typography>
                <TextField
                  label={tr("emailLabel")}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setProblem(""); }}
                  error={!!problem}
                  helperText={problem}
                  fullWidth
                />
                {failed && <Alert severity="error">{tr("errorGeneric")}</Alert>}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton tip={tr("tipForgotPasswordClose")} onClick={onClose}>{tr("forgotPasswordClose")}</ActionButton>
          {!sent && (
            <ActionButton tip={tr("tipForgotPasswordSubmit")} type="submit" variant="contained" disabled={busy}>
              {tr("forgotPasswordSubmit")}
            </ActionButton>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
