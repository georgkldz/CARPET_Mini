<template>
  <q-layout>
    <q-page-container>
      <q-page class="q-pa-md">
        <div class="row justify-center q-col-gutter-md">
          <div class="col-12 col-sm-8 col-md-6">
            <q-card>
              <q-card-section class="text-h5">Hallo Student!</q-card-section>
              <q-card-section class="text-body1">
                Was möchtest du als Nächstes tun?
              </q-card-section>
              <q-separator />

              <q-card-actions align="center">
                <q-btn
                  color="primary"
                  label="Aufgabe bearbeiten"
                  @click="goToTaskEdit"
                />
                <q-btn
                  color="grey-5"
                  label="Aufgabe kommentieren (noch nicht verfügbar)"
                  @click="notImplemented"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

function goToTaskEdit() {
  // Beispiel: navigiere zum MainLayout oder wo auch immer hin
  router.push("/main-layout");
}

function notImplemented() {
  //TODO
}
</script>
