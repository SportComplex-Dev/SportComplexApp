'use client'

import React from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@sportcomplex/ui'
import { Sparkles, Percent } from 'lucide-react'

interface PosClientFormProps {
  clientDoc: string
  onClientDocChange: (doc: string) => void
  clientName: string
  onClientNameChange: (name: string) => void
  clientEmail: string
  onClientEmailChange: (email: string) => void
  clientPhone: string
  onClientPhoneChange: (phone: string) => void
  isMember: boolean
  onIsMemberChange: (isMember: boolean) => void
  onQuickWalkIn: () => void
}

export function PosClientForm({
  clientDoc,
  onClientDocChange,
  clientName,
  onClientNameChange,
  clientEmail,
  onClientEmailChange,
  clientPhone,
  onClientPhoneChange,
  isMember,
  onIsMemberChange,
  onQuickWalkIn,
}: PosClientFormProps) {
  return (
    <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
      <CardHeader className="pb-3 border-b border-[var(--line)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-[#123e30] text-[#c9ef75] text-xs font-bold">2</span>
            Datos del Cliente
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onQuickWalkIn}
            className="text-[11px] h-7 px-2"
            type="button"
          >
            <Sparkles size={13} className="text-[#c9ef75]" /> Walk-in
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-3">
        <div>
          <label htmlFor="pos-client-doc" className="text-xs text-[var(--subtle)] mb-1 block">
            Cédula / Documento *
          </label>
          <Input
            id="pos-client-doc"
            placeholder="Ej. 1020304050"
            value={clientDoc}
            onChange={(e) => onClientDocChange(e.target.value.replace(/\D/g, ''))}
            className="text-xs"
            required
          />
        </div>

        <div>
          <label htmlFor="pos-client-name" className="text-xs text-[var(--subtle)] mb-1 block">
            Nombre Completo *
          </label>
          <Input
            id="pos-client-name"
            placeholder="Ej. Carlos Santana"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            className="text-xs"
            required
          />
        </div>

        <div>
          <label htmlFor="pos-client-email" className="text-xs text-[var(--subtle)] mb-1 block">
            Correo Electrónico *
          </label>
          <Input
            id="pos-client-email"
            type="email"
            placeholder="cliente@ejemplo.com"
            value={clientEmail}
            onChange={(e) => onClientEmailChange(e.target.value)}
            className="text-xs"
            required
          />
          <p className="text-[10px] text-[var(--subtle)] mt-1">Para entrega del comprobante y pase digital.</p>
        </div>

        <div>
          <label htmlFor="pos-client-phone" className="text-xs text-[var(--subtle)] mb-1 block">
            Teléfono Móvil (WhatsApp)
          </label>
          <Input
            id="pos-client-phone"
            type="tel"
            placeholder="Ej. 300 123 4567"
            value={clientPhone}
            onChange={(e) => onClientPhoneChange(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Beneficio de Membresía del 30% (RN-08) */}
        <div className="mt-2 pt-3 border-t border-[var(--line)]">
          <label htmlFor="pos-client-member" className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="pos-client-member"
              type="checkbox"
              checked={isMember}
              onChange={(e) => onIsMemberChange(e.target.checked)}
              className="size-4 accent-[#123e30] rounded"
            />
            <div className="flex-1">
              <span className="text-xs font-semibold flex items-center gap-1">
                Socio AKROS Vigente <Percent size={12} className="text-[#5e8b48]" />
              </span>
              <p className="text-[10px] text-[var(--subtle)]">
                Aplica 30% de descuento automático verificado en servidor (RN-08 / SEC-03).
              </p>
            </div>
          </label>
          {isMember && (
            <div className="mt-2 p-2 bg-[#edf5e2] text-[#4b7652] dark:bg-[#1f3524] dark:text-[#9ee285] rounded text-[11px] font-medium border border-[#5e8b48]/30">
              ✓ Descuento del 30% solicitado (el servidor verificará estado VIGENTE).
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
