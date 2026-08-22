import { useEffect, useRef, useState, type JSX } from 'react'

export interface PromptRequest {
  title: string
  label: string
  value: string
  placeholder?: string
  confirmLabel?: string
  onSubmit: (value: string) => void
}

/**
 * Electron renderers have no window.prompt, so link and image URLs are collected
 * with a native <dialog> instead.
 */
export function PromptDialog({
  request,
  onClose
}: {
  request: PromptRequest | null
  onClose: () => void
}): JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!request) return
    setValue(request.value)
    ref.current?.showModal()
  }, [request])

  if (!request) return null

  function submit(event: React.FormEvent): void {
    event.preventDefault()
    ref.current?.close()
    request!.onSubmit(value.trim())
    onClose()
  }

  function cancel(): void {
    ref.current?.close()
    onClose()
  }

  return (
    <dialog ref={ref} className="prompt" onCancel={cancel}>
      <form onSubmit={submit}>
        <h2>{request.title}</h2>
        <label>
          {request.label}
          <input
            autoFocus
            value={value}
            placeholder={request.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="actions">
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {request.confirmLabel ?? 'OK'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
