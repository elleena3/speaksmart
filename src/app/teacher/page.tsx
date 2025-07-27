
"use client"
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TeacherPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/teacher/dashboard');
  }, [router]);

  return null;
}
