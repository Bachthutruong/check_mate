"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, User } from "@/contexts/auth-context"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  History,
  LayoutGrid,
  Settings,
  Users,
  Warehouse,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  roles: User["role"][]
}

const navItems: NavItem[] = [
  { href: "/dashboard/inventory", label: "Inventory Check", icon: LayoutGrid, roles: ["employee", "admin"] },
  { href: "/dashboard/history", label: "History", icon: History, roles: ["employee", "admin"] },
  { href: "/dashboard/admin/stores", label: "Stores", icon: Warehouse, roles: ["admin"] },
  { href: "/dashboard/admin/employees", label: "Employees", icon: Users, roles: ["admin"] },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!user) return null

  const accessibleNavItems = navItems.filter(item => item.roles.includes(user.role))

  return (
    <SidebarMenu>
      {accessibleNavItems.map(item => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} legacyBehavior passHref>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.href)}
              tooltip={item.label}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
