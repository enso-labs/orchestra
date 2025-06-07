import AuthLayout from "@/layouts/AuthLayout"
import DashboardSection from "@/components/sections/dashboard"

export function DashboardPage() {

  return (
    <AuthLayout>
      <DashboardSection />
    </AuthLayout>
  )
}

export default DashboardPage;