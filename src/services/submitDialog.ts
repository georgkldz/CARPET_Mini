import { Dialog } from "quasar"
import SubmitPermissionDialog from "components/SubmitPermissionDialog.vue"
import type { Vote } from "stores/collaborationStore"

let dialogActive = false

export function askForSubmitPermission (): Promise<Vote> {
  return new Promise<Vote>((resolve) => {
    if (dialogActive) {
      console.debug("[Collab] Abstimmungs-Dialog war bereits offen")
      return
    }
    console.debug("subMitDialog betreten")
    dialogActive = true
    Dialog.create({ component: SubmitPermissionDialog })
      .onOk    ((v: Vote) => resolve(v))     // 'accepted' | 'rejected'
      .onCancel(()       => resolve("rejected"))
      .onDismiss(()      => resolve("rejected"))     // ESC / Outside click
  })
}
