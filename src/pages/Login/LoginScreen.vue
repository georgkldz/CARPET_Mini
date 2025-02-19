<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center">
        <q-card class="q-pa-md" style="max-width: 400px; width: 100%">
          <q-card-section>
            <div class="text-h5 text-center">Anmeldung</div>
          </q-card-section>

          <q-card-section>
            <q-form @submit.prevent="handleSubmit">
              <q-input
                filled
                type="email"
                label="E-Mail-Adresse"
                v-model="email"
                class="q-mb-md"
                :disable="loading"
                required
              />
              <q-input
                filled
                type="password"
                label="Passwort"
                v-model="password"
                class="q-mb-md"
                :disable="loading"
                required
              />
              <div class="text-center">
                <q-btn
                  color="primary"
                  label="Anmelden"
                  type="submit"
                  :loading="loading"
                  :disable="loading"
                />
              </div>
            </q-form>
            <div v-if="error" class="q-mt-md text-negative text-center">
              {{ error }}
            </div>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
// Beispiel: du verwendest einen separaten authStore:
import { useAuthStore } from "src/stores/authStore";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
  error.value = null;
  loading.value = true;
  try {
    await authStore.login(email.value, password.value);
    // Nach Login -> Rolle checken
    if (authStore.currentUser?.role === 1) {
      // Student
      router.push("/student-selection");
    } else if (authStore.currentUser?.role === 2) {
      // Lehrende
      router.push("/teacher-selection");
    } else {
      // Fallback: z. B. Index
      router.push("/");
    }
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  } catch (err: any) {
    error.value = err.message || "Anmeldung fehlgeschlagen";
  } finally {
    loading.value = false;
  }
}
</script>
