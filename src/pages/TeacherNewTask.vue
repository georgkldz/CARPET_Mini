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
              <q-input
                filled
                type="text"
                label="Aufgabenbeschreibung*"
                v-model="formData.description"
                :error="!!errors.description"
                :error-message="errors.description"
                required
              />
              <q-input
                filled
                type="textarea"
                label="Lösung*"
                autogrow
                v-model="formData.solution"
                :error="!!errors.solution"
                :error-message="errors.solution"
                required
              />
              <q-input
                filled
                type="textarea"
                label="Hinweis (optional)"
                autogrow
                v-model="formData.hint"
              />
              <div class="row justify-center">
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
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { useTasksStore } from "src/stores/tasksStore";
import { useQuasar } from "quasar";
import type { Task } from "src/models/Task";
const router = useRouter();
const tasksStore = useTasksStore();
const $q = useQuasar();

const formData = reactive<Partial<Task>>({
  description: "",
  solution: "",
  hint: ""
});

interface Errors {
  description: string;
  solution: string;
}

const errors = reactive<Errors>({
  description: "",
  solution: ""
});


function validateForm() {
  errors.description = formData.description ? "" : "Bitte eingeben!";
  errors.solution = formData.solution ? "" : "Bitte eingeben!";
  return !errors.description && !errors.solution;
}

async function handleCreateTask() {
  if (!validateForm()) return;

  try {
    await tasksStore.createTask({
      description: formData.description as string,
      solution: formData.solution as string,
      hint: formData.hint
    });
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
