<template>
  <q-layout>
    <q-page-container>
      <q-page class="q-pa-md">

        <div class="row justify-center">
          <div class="col-12 col-sm-8 col-md-6">
            <q-card>
              <q-card-section>
                <div class="text-h5">Neue Aufgabe erstellen</div>
              </q-card-section>

              <q-card-section>
                <q-form @submit.prevent="handleCreateTask" class="q-gutter-md">

                  <!-- Aufgabenbeschreibung -->
                  <q-input
                    filled
                    type="text"
                    label="Aufgabenbeschreibung*"
                    v-model="formData.description"
                    :error="!!errors.description"
                    :error-message="errors.description"
                    required
                  />

                  <!-- Symmetrie & Grad -->
                  <div class="row q-col-gutter-md">
                    <div class="col">
                      <div class="text-subtitle2">Symmetrie</div>
                      <q-option-group
                        v-model="formData.symmetry"
                        :options="symmetryOptions"
                        inline
                      />
                    </div>

                    <div class="col">
                      <div class="text-subtitle2">Grad der Funktion</div>
                      <q-spinner
                        v-model="formData.degree"
                        :max="degreeMax"
                        :min="2"
                      />
                      <!-- Alternativ: q-select oder q-input type=number -->
                    </div>
                  </div>

                  <div class="q-mt-md text-h6">Lösungsansätze: Gleichungen</div>
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 1"
                    v-model="formData.textFieldEquation1"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 2"
                    v-model="formData.textFieldEquation2"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 3"
                    v-model="formData.textFieldEquation3"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 4"
                    v-model="formData.textFieldEquation4"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 5"
                    v-model="formData.textFieldEquation5"
                  />

                  <div class="q-mt-md text-h6">Musterlösung der weiteren Aufgabenbearbeitung</div>
                  <q-input
                    filled
                    type="textarea"
                    label="(optional)"
                    autogrow
                    v-model="formData.sampleSolutionCollaborativeWork"
                  />

                  <div class="row justify-center q-mt-md">
                    <q-btn color="primary" label="Aufgabe erstellen" type="submit" />
                  </div>
                </q-form>
              </q-card-section>
            </q-card>
          </div>
        </div>

      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { useTasksStore } from "src/stores/tasksStore";
import { useQuasar } from "quasar";
import type { Task } from "src/models/Task";

const router = useRouter();
const tasksStore = useTasksStore();
const $q = useQuasar();

interface FormData extends Partial<Task> {
  symmetry: "even" | "odd" | "none";
  degree: number;
}
interface Errors {
  description: string;
}

// Reaktives Objekt
const formData = reactive<FormData>({
  description: "",
  hint: "",
  symmetry: "none",
  degree: 2,
  textFieldEquation1: "",
  textFieldEquation2: "",
  textFieldEquation3: "",
  textFieldEquation4: "",
  textFieldEquation5: "",
  sampleSolutionCollaborativeWork: "",
});

const errors = reactive<Errors>({
  description: "",
});

// Radiobutton-Optionen
const symmetryOptions = [
  { label: "gerade", value: "even" },
  { label: "ungerade", value: "odd" },
  { label: "keine", value: "none" },
];

// Dynamisch berechnetes `max` für degree
const degreeMax = computed(() => {
  if (formData.symmetry === "none") {
    return 4; // max 4
  } else if (formData.symmetry === "odd") {
    return 5; // max 5
  }
  return 6;   // standard: 6 (z.B. wenn symmetry = 'even' oder was anderes)
});

function validateForm() {
  errors.description = formData.description ? "" : "Bitte eingeben!";
  return !errors.description;
}

async function handleCreateTask() {
  if (!validateForm()) return;

  try {
    // Da du "Task" erweiterst, hier anlegen:
    await tasksStore.createTask({
      // Nicht alle Felder in Task sind mandatory => Partial<Task>
      description: formData.description as string,
      hint: formData.hint ?? "",
      degree: formData.degree,
      symmetry: formData.symmetry,
      textFieldEquation1: formData.textFieldEquation1 ?? "",
      textFieldEquation2: formData.textFieldEquation2 ?? "",
      textFieldEquation3: formData.textFieldEquation3 ?? "",
      textFieldEquation4: formData.textFieldEquation4 ?? "",
      textFieldEquation5: formData.textFieldEquation5 ?? "",
      sampleSolutionCollaborativeWork: formData.sampleSolutionCollaborativeWork ?? "",
      // Falls es noch weitere Spalten gibt (z.B. createdAt),
      // handled das der Server/die DB.
    } as Task);

    router.push("/teacher-selection");
  } catch (error) {
    console.error("Fehler beim Erstellen der Aufgabe:", error);
    $q.notify({
      color: "negative",
      message: "Erstellen fehlgeschlagen!",
      position: "top"
    });
  }
}
</script>

<style scoped>
/* ggf. eigenes CSS */
</style>
