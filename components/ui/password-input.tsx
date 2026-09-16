'use client'

import * as React from 'react'
import {Eye,EyeOff} from 'lucide-react'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'

function PasswordInput({className,...props}:Omit<React.ComponentProps<'input'>,'type'>){
 const [visible,setVisible]=React.useState(false)
 return <div className="relative w-full">
  <Input {...props} type={visible?'text':'password'} className={cn('pr-11',className)}/>
  <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" aria-label={visible?'Hide password':'Show password'} title={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff aria-hidden="true" className="size-4"/>:<Eye aria-hidden="true" className="size-4"/>}</button>
 </div>
}

export {PasswordInput}
