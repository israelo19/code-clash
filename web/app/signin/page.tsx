import { SignInForm } from "@/components/SignInForm";

// Patient sign-in page, at /signin.
// The form itself lives in components/SignInForm.tsx and is shared with the clinician sign-in page.
export default function PatientSignIn() {
  return <SignInForm role="patient" />;
}
