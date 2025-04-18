<template>
  <q-layout>
    <q-page-container>
      <q-page class="q-pa-md">
        <div class="row justify-center q-col-gutter-md">
          <div class="col-12 col-sm-8 col-md-6">
            <q-card>
              <q-card-section class="text-h5">Hallo Lehrende/r!</q-card-section>
              <q-card-section class="text-body1">
                Was möchtest du als Nächstes tun?
              </q-card-section>
              <q-separator />

              <q-card-actions
                align="center"
                class="q-pa-md column q-gutter-y-md"
              >
                <q-btn
                  color="primary"
                  label="Neue Aufgabe erstellen"
                  @click="goToNewTask"
                  class="full-width"
                />
                <q-btn
                  color="secondary"
                  label="Zurückliegende Bearbeitungen kommentieren"
                  @click="notImplemented"
                  class="full-width"
                />
                <q-btn
                  color="deep-purple"
                  label="Assessment anleiten"
                  @click="guideAssessment"
                  class="full-width"
                />
                <q-btn
                  color="teal"
                  label="Assessment konfigurieren"
                  @click="configureAssessment"
                  class="full-width"
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

function goToNewTask() {
  router.push("/create-task");
}

function notImplemented() {
  //TODO
}

function guideAssessment() {
  router.push("/guide-assessment");
}

function configureAssessment() {
  router.push("/configure-assessment");
}
</script>
