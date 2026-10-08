import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Separator } from '../components/ui/separator'
import { GitBranch, Globe } from 'lucide-react'

export function AuthModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Welcome to DOME</DialogTitle>
          <DialogDescription>
            Sign in to sync your projects across devices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button variant="default" className="w-full justify-start">
            <GitBranch className="h-4 w-4" />
            Continue with GitHub
          </Button>
          <Button variant="default" className="w-full justify-start">
            <Globe className="h-4 w-4" />
            Continue with Google
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-[11px] text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid gap-2">
          <Input type="email" placeholder="you@email.com" aria-label="Email address" />
          <Button variant="outline" className="w-full">
            Send magic link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
