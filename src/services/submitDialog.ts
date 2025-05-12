import { Dialog } from "quasar"
import SubmitPermissionDialog from "components/SubmitPermissionDialog.vue"
import type { Vote } from "stores/collaborationStore"

/**
 * Zeigt den Abstimmungs‑Dialog und gibt das Votum des Anwenders zurück.
 */
export function askForSubmitPermission (): Promise<Vote> {
  return new Promise<Vote>((resolve) => {
    Dialog.create({ component: SubmitPermissionDialog })
      .onOk    ((v: Vote) => resolve(v))     // 'accepted' | 'rejected'
      .onCancel(()       => resolve("rejected"))
      .onDismiss(()      => resolve("rejected"))     // ESC / Outside click
  })
}
