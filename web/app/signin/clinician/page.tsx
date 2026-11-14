import { SignInForm } from "@/components/SignInForm";

// Clinician sign-in page, at /signin/clinician.
// Same form as the patient page, with the clinician demo account and wording.
export default function ClinicianSignIn() {
  return <SignInForm role="clinician" />;
}
