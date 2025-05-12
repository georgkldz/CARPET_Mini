<!-- src/components/SubmitPermissionDialog.vue -->
<template>
  <!-- Wichtig: ref="dialogRef" statt v-model -->
  <q-dialog ref="dialogRef" persistent transition-show="jump-down" transition-hide="jump-up">
    <q-card style="min-width:280px">
      <q-card-section class="text-h6">
        Gruppen‑Abschluss bestätigen
      </q-card-section>

      <q-card-section>
        Stimmst du zu, die Bearbeitung der Aufgabe abzuschließen?
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat color="negative" label="Ablehnen"
          @click="emitAndClose('rejected')"
        />
        <q-btn
          flat color="primary"  label="Zustimmen"
          @click="emitAndClose('accepted')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar"
import type { Vote } from "stores/collaborationStore"

/* Variante B – Generics‑Form, kein unbenutzter Parameter mehr */
const emit = defineEmits<{
  (e: "ok", vote: Vote): void
}>()

const { dialogRef, onDialogOK } = useDialogPluginComponent()

function emitAndClose (decision: Vote) {
  emit("ok", decision)       // für Eltern‑Komponenten (optional)
  onDialogOK(decision)       // löst Promise in Dialog.create() aus
}
</script>
