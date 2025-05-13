// submitDialog.ts
import { Dialog } from "quasar"
import SubmitPermissionDialog from "components/SubmitPermissionDialog.vue"
import type { Vote } from "stores/collaborationStore"

let dialogActive = false

export function askForSubmitPermission (): Promise<Vote> {
  return new Promise<Vote>((resolve) => {
    if (dialogActive) {
      console.debug("subMitDialog, Abstimmungs‑Dialog war bereits offen")
      return
    }

    dialogActive = true
    Dialog.create({ component: SubmitPermissionDialog })
      .onOk((v: Vote) => {
        dialogActive = false                 // ✅ Flag zurücksetzen
        resolve(v)                           // 'accepted' | 'rejected'
      })
      .onCancel(() => {
        dialogActive = false                 // ✅
        resolve("rejected")
      })
      .onDismiss(() => {
        dialogActive = false                 // ✅ ESC / Outside click
        resolve("rejected")
      })
  })
}
