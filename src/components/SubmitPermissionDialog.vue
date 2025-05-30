<!-- src/components/SubmitPermissionDialog.vue -->
<template>
  <!-- Wichtig: ref="dialogRef" statt v-model -->
  <q-dialog ref="dialogRef" persistent seamless transition-show="jump-down" transition-hide="jump-up">
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

<script lang="ts">
import { defineComponent } from "vue";
import { useDialogPluginComponent } from "quasar";

export default defineComponent({
  name: "SubmitPermissionDialog",

  emits: [
    ...useDialogPluginComponent.emits
  ],

  setup() {
    const { dialogRef, onDialogOK } = useDialogPluginComponent();

    const emitAndClose = (vote: "accepted" | "rejected") => {
      // Verwende die Standard Quasar Dialog API
      onDialogOK(vote);
    };

    return {
      dialogRef,
      emitAndClose
    };
  }
});
</script>
