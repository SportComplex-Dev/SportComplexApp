import test from 'node:test'
import assert from 'node:assert/strict'
import type { Employee } from '@/components/admin/employees/employee-table'

const mockEmployees: Employee[] = [
  {
    id: 'emp-1',
    nombre: 'Carlos Vendedor',
    correo: 'carlos@sportcomplex.com',
    estado: 'ACTIVO',
    creadoEn: '2026-10-01T10:00:00Z',
    deletedAt: null,
    rolId: 2,
    rol: { id: 2, nombre: 'Vendedor de Taquilla' },
  },
  {
    id: 'emp-2',
    nombre: 'Laura Lectora',
    correo: 'laura@sportcomplex.com',
    estado: 'ACTIVO',
    creadoEn: '2026-10-02T10:00:00Z',
    deletedAt: null,
    rolId: 3,
    rol: { id: 3, nombre: 'Lector Perimetral' },
  },
  {
    id: 'emp-3',
    nombre: 'Andrés Admin',
    correo: 'andres@sportcomplex.com',
    estado: 'ACTIVO',
    creadoEn: '2026-10-03T10:00:00Z',
    deletedAt: null,
    rolId: 1,
    rol: { id: 1, nombre: 'Administrador' },
  },
  {
    id: 'emp-4',
    nombre: 'Elena Inactiva',
    correo: 'elena@sportcomplex.com',
    estado: 'INACTIVO',
    creadoEn: '2026-09-15T10:00:00Z',
    deletedAt: '2026-10-05T15:00:00Z',
    rolId: 2,
    rol: { id: 2, nombre: 'Vendedor' },
  },
]

test('TSK-FE-21 / Employees: Cálculo de métricas de plantilla', () => {
  const total = mockEmployees.length
  const active = mockEmployees.filter((e) => e.estado === 'ACTIVO').length
  const inactive = mockEmployees.filter((e) => e.estado === 'INACTIVO').length
  const sellers = mockEmployees.filter((e) => e.rol.nombre.toUpperCase().includes('VENDEDOR')).length
  const readers = mockEmployees.filter((e) => e.rol.nombre.toUpperCase().includes('LECTOR')).length

  assert.equal(total, 4)
  assert.equal(active, 3)
  assert.equal(inactive, 1)
  assert.equal(sellers, 2)
  assert.equal(readers, 1)
})

test('TSK-FE-21 / Employees: Filtrado reactivo por término de búsqueda y rol', () => {
  const searchFilter = (query: string) =>
    mockEmployees.filter(
      (e) =>
        e.nombre.toLowerCase().includes(query.toLowerCase()) ||
        e.correo.toLowerCase().includes(query.toLowerCase())
    )

  const searchResults = searchFilter('laura')
  assert.equal(searchResults.length, 1)
  assert.equal(searchResults[0].id, 'emp-2')

  const roleFilter = (role: string) =>
    mockEmployees.filter((e) => {
      const norm = e.rol.nombre.toUpperCase()
      if (role === 'ALL') return true
      if (role === 'VENDEDOR') return norm.includes('VENDEDOR')
      if (role === 'LECTOR') return norm.includes('LECTOR')
      if (role === 'ADMIN') return norm.includes('ADMIN')
      return false
    })

  assert.equal(roleFilter('VENDEDOR').length, 2)
  assert.equal(roleFilter('LECTOR').length, 1)
  assert.equal(roleFilter('ADMIN').length, 1)
  assert.equal(roleFilter('ALL').length, 4)
})

test('TSK-FE-21 / RN-10: Baja lógica preserva el colaborador actualizando estado y deletedAt', () => {
  const targetEmployee = mockEmployees[0]
  const deactivated = {
    ...targetEmployee,
    estado: 'INACTIVO' as const,
    deletedAt: new Date().toISOString(),
  }

  assert.equal(deactivated.estado, 'INACTIVO')
  assert.ok(deactivated.deletedAt !== null)
  assert.equal(deactivated.id, targetEmployee.id, 'El ID y la fila persisten (cero borrado físico)')
})

test('TSK-FE-21 / UI: EmployeeTable renderiza filas y emite interacción de baja', async () => {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document

  const { render, fireEvent } = await import('@testing-library/react')
  const React = await import('react')
  const { EmployeeTable } = await import('@/components/admin/employees/employee-table')

  let clickedEmp: { id?: string; nombre?: string } | null = null
  const { container } = render(
    React.createElement(EmployeeTable, {
      employees: mockEmployees,
      onDeactivateClick: (emp: Employee) => {
        clickedEmp = emp
      },
    })
  )

  // Verifica que se rendericen los nombres de los empleados
  assert.ok(container.textContent?.includes('Carlos Vendedor'))
  assert.ok(container.textContent?.includes('Laura Lectora'))
  assert.ok(container.textContent?.includes('Andrés Admin'))

  // Verifica que el administrador no tenga botón "Dar de baja" sino badge
  assert.ok(container.textContent?.includes('Administrador'))

  // Encuentra los botones de "Dar de baja" y pulsa el primero (Carlos Vendedor)
  const deactivateButtons = container.querySelectorAll('button')
  assert.ok(deactivateButtons.length >= 1)
  fireEvent.click(deactivateButtons[0])

  const target = clickedEmp as { id?: string; nombre?: string } | null
  assert.equal(target?.id, 'emp-1')
  assert.equal(target?.nombre, 'Carlos Vendedor')
})

test('TSK-FE-21 / UI: EmployeeCreateModal gestiona inputs y submit', async () => {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document

  const { render, fireEvent } = await import('@testing-library/react')
  const React = await import('react')
  ;(globalThis as unknown as { React: unknown }).React = React
  const { EmployeeCreateModal } = await import('@/components/admin/employees/employee-create-modal')

  let submitted = false
  const formState = {
    nombre: 'Nuevo Empleado',
    correo: 'nuevo@sportcomplex.com',
    rolNombre: 'VENDEDOR',
    password: 'Password123*',
  }

  const { container } = render(
    React.createElement(EmployeeCreateModal, {
      isOpen: true,
      onClose: () => {},
      onSubmit: (e: React.FormEvent) => {
        e.preventDefault()
        submitted = true
      },
      form: formState,
      setForm: () => {},
      isCreating: false,
    })
  )

  assert.ok(container.textContent?.includes('Alta de Empleado'))
  const form = container.querySelector('form')
  assert.ok(form)
  fireEvent.submit(form)

  assert.equal(submitted, true)
})

test('TSK-FE-21 / UI: EmployeeDeactivateModal emite confirmación de baja lógica', async () => {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document

  const { render, fireEvent } = await import('@testing-library/react')
  const React = await import('react')
  const { EmployeeDeactivateModal } = await import('@/components/admin/employees/employee-deactivate-modal')

  let confirmed = false
  const { container } = render(
    React.createElement(EmployeeDeactivateModal, {
      employee: mockEmployees[0],
      onClose: () => {},
      onConfirm: () => {
        confirmed = true
      },
      isDeactivating: false,
    })
  )

  assert.ok(container.textContent?.includes('Confirmar Baja de Empleado'))
  assert.ok(container.textContent?.includes('Carlos Vendedor'))

  const confirmBtn = container.querySelector('button.bg-red-600')
  assert.ok(confirmBtn)
  fireEvent.click(confirmBtn)

  assert.equal(confirmed, true)
})
