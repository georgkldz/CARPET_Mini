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
                    v-model="formData.solutions.textFieldEquation1"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 2"
                    v-model="formData.solutions.textFieldEquation2"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 3"
                    v-model="formData.solutions.textFieldEquation3"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 4"
                    v-model="formData.solutions.textFieldEquation4"
                  />
                  <q-input
                    filled
                    type="text"
                    label="Gleichung 5"
                    v-model="formData.solutions.textFieldEquation5"
                  />

                  <div class="q-mt-md text-h6">
                    Musterlösung der weiteren Aufgabenbearbeitung
                  </div>
                  <q-input
                    filled
                    type="textarea"
                    label="(optional)"
                    autogrow
                    v-model="formData.solutions.sampleSolutionCollaborativeWork"
                  />

                  <div class="row justify-center q-mt-md">
                    <q-btn
                      color="primary"
                      label="Aufgabe erstellen"
                      type="submit"
                    />
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

/* ---------- Typen ---------- */
interface FormData {
  description: string;
  hint: string;
  symmetry: "even" | "odd" | "none";
  degree: number;
  solutions: {
    textFieldEquation1: string;
    textFieldEquation2: string;
    textFieldEquation3: string;
    textFieldEquation4: string;
    textFieldEquation5: string;
    sampleSolutionCollaborativeWork: string;
  };
}
interface Errors {
  description: string;
}

/* ---------- Reaktiver State ---------- */
const formData = reactive<FormData>({
  description: "",
  hint: "",
  symmetry: "none",
  degree: 2,
  solutions: {
    textFieldEquation1: "",
    textFieldEquation2: "",
    textFieldEquation3: "",
    textFieldEquation4: "",
    textFieldEquation5: "",
    sampleSolutionCollaborativeWork: "",
  },
});

const errors = reactive<Errors>({ description: "" });

/* ---------- UI‑Konstanten ---------- */
const symmetryOptions = [
  { label: "gerade", value: "even" },
  { label: "ungerade", value: "odd" },
  { label: "keine", value: "none" },
];

const degreeMax = computed(() => {
  return formData.symmetry === "none" ? 4 : formData.symmetry === "odd" ? 5 : 6;
});

/* ---------- Validierung ---------- */
function validateForm() {
  errors.description = formData.description ? "" : "Bitte eingeben!";
  return !errors.description;
}

/* ---------- Absenden ---------- */
async function handleCreateTask() {
  if (!validateForm()) return;

  // ❶  newTask OHNE taskId typisieren
  const newTask: Omit<Task, "taskId"> = {
    description: formData.description,
    hint: formData.hint,
    degree: formData.degree,
    symmetry: formData.symmetry,
    solutions: { ...formData.solutions },
  };

  try {
    // ❷  createTask erwartet bereits Omit<Task,"taskId"> – passt also
    await tasksStore.createTask(newTask);
    router.push("/teacher-selection");
  } catch (error) {
    console.error("Fehler beim Erstellen:", error);
    $q.notify({
      color: "negative",
      message: "Erstellen fehlgeschlagen!",
      position: "top",
    });
  }
}
</script>

<style scoped>
/* ggf. eigenes CSS */
</style>
