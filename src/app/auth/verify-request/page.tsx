import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function VerifyRequestPage() {
  // This page is no longer used for magic links — redirect to OTP page
  redirect('/auth/verify-otp');
}
