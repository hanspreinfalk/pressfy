'use client'

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { Loader2Icon } from "lucide-react"
import { SignInView } from "../views/sign-in-view"
import { AuthLayout } from "../layouts/auth-layout"

export function AuthGuard({ children }: { children: React.ReactNode }) {
    return (
        <>
            <AuthLoading>
                <AuthLayout>
                    <p className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
                        Loading...
                    </p>
                </AuthLayout>
            </AuthLoading>
            <Authenticated>
                {children}
            </Authenticated>
            <Unauthenticated>
                <AuthLayout>
                    <SignInView />
                </AuthLayout>
            </Unauthenticated>
        </>
    )
}