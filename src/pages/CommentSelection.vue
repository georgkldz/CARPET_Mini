<template>
  <q-layout>
    <q-page-container>
      <q-page padding>
        <div class="q-pa-md">
          <h1 class="text-h4 q-mb-lg">Kommentar-Auswahl</h1>
          <p class="text-h6 q-mb-md">Wähle eine Aufzeichnung, die du kommentieren willst</p>

          <!-- Manuelle Session-ID Eingabe -->
          <div class="row q-mb-lg">
            <q-input
              v-model.number="manualSessionId"
              type="number"
              label="Oder gib eine Aufzeichnungsnummer ein"
              :rules="[
                val => Number.isInteger(val) || 'Deine Eingabe muss eine Zahl sein',
                ()  => !hasValidationError.value || 'Diese Aufzeichnung gibt es nicht'
              ]"
              outlined
              dense
            />
            <q-btn
              label="Auswählen"
              color="primary"
              :loading="validating"
              @click="validateAndSelect"
              class="q-ml-sm"
            />
          </div>

          <!-- Sessions-Tabelle -->
          <div class="q-pa-md">
            <q-table
              :rows="sessions"
              :columns="columns"
              row-key="sessionId"
              :loading="commentStore.isLoading"
              :pagination="{ rowsPerPage: 10 }"
              v-if="!commentStore.isLoading && sessions.length > 0"
            >
              <!-- zweizeiliger Header -->
              <template v-slot:header>
                <tr>
                  <!-- Die ersten vier Spalten normal -->
                  <th colspan="4"></th>
                  <!-- Eine einzige Überschrift über 4 Spalten -->
                  <th colspan="4" class="text-center">Mitwirkende</th>
                </tr>
                <tr>
                  <!-- Leere Zellen für die ersten vier Spalten, um Alignment zu halten -->
                  <th v-for="col in columns.slice(0, 4)" :key="col.name">{{ col.label }}</th>
                  <!-- Jetzt vier Unter-Überschriften -->
                  <th>Ergebnis­verantw.</th>
                  <th>Kommentar­protokoll</th>
                  <th>Gesprächs­leiter</th>
                  <th>Zeit­wächter</th>
                </tr>
              </template>

              <template v-slot:body="props">
                <q-tr :props="props">
                  <!-- Deine ersten vier Zellen: sessionId, taskId, ... -->
                  <q-td key="sessionId" :props="props">
                    <q-btn flat dense @click="selectSession(props.row.sessionId)">
                      {{ props.row.sessionId }}
                    </q-btn>
                  </q-td>
                  <q-td key="taskId"            :props="props">{{ props.row.taskId }}</q-td>
                  <q-td key="taskDescription"   :props="props">{{ props.row.taskDescription }}</q-td>
                  <q-td key="timestamp"         :props="props">{{ formatDate(props.row.timestamp) }}</q-td>

                  <!-- Nun vier Zellen für die Rollen -->
                  <q-td>{{ getRoleMember(props.row.sessionId, 0) }}</q-td>
                  <q-td>{{ getRoleMember(props.row.sessionId, 1) }}</q-td>
                  <q-td>{{ getRoleMember(props.row.sessionId, 2) }}</q-td>
                  <q-td>{{ getRoleMember(props.row.sessionId, 3) }}</q-td>
                </q-tr>
              </template>
            </q-table>

            <div class="text-center q-pa-md" v-else-if="!commentStore.isLoading && sessions.length === 0">
              <q-icon name="sentiment_dissatisfied" size="2em" />
              <p>Keine Aufzeichnungen gefunden</p>
            </div>

            <div class="text-center q-pa-md" v-if="commentStore.isLoading">
              <q-spinner color="primary" size="3em" />
              <p>Lade Aufzeichnungen...</p>
            </div>
          </div>
        </div>
      </q-page>
      </q-page-container>
    </q-layout>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from "vue";
//import { useRouter } from "vue-router";
import { Notify } from "quasar";
import { useCommentStore } from "src/stores/commentStore";

export default defineComponent({
  name: "CommentSelection",

  setup() {
    const commentStore = useCommentStore();
    //const router = useRouter();

    const manualSessionId = ref(null);
    const validating = ref(false);
    const hasValidationError = ref(false);

    // Tabellenstruktur
    const columns = [
      { name: "sessionId", label: "Aufzeichnung Nr.", field: "sessionId", sortable: true, style: "width: 10%" },
      { name: "taskId",     label: "Aufgabe Nr.",      field: "taskId",     sortable: true, style: "width: 10%" },
      { name: "taskDescription", label: "Aufgabenstellung", field: "taskDescription", style: "width: 20%", align: "left", classes: "q-pa-xs wrap-description" },
      { name: "timestamp", align: "left", label: "Datum", field: "timestamp", sortable: true }
    ];

    // Sessions aus dem Store abrufen
    const sessions = computed(() => commentStore.availableSessions);

    // Datum formatieren: deutsches Format ohne Sekunden
    const formatDate = (timestamp) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    };

    // Mitglieds-ID für eine Rolle finden
    const getRoleMember = (sessionId, roleId) => {
      return commentStore.getMemberByRole(sessionId, roleId);
    };

    // Session auswählen und zur nächsten Seite navigieren
    const selectSession = (sessionId) => {
      commentStore.setCurrentSessionId(sessionId);
      // Hier Navigation zur Kommentar-Seite einbauen
      // router.push('/comment-editor');
    };

    // Eingegebene Session-ID validieren
    async function validateAndSelect() {
      if (manualSessionId.value === null) return

      validating.value = true
      hasValidationError.value = false

      try {
        const isValid = await commentStore.validateSessionId(manualSessionId.value)
        if (isValid) {
          commentStore.setCurrentSessionId(manualSessionId.value)
          Notify.create({ type: "positive", message: `Aufzeichnung ${manualSessionId.value} ausgewählt` })
        } else {
          hasValidationError.value = true
          Notify.create({ type: "negative", message: "Diese Aufzeichnung existiert nicht" })
        }
      }
      catch (err) {
        // z. B. Netzwerkfehler
        hasValidationError.value = true
        Notify.create({ type: "negative", message: "Fehler beim Prüfen der Aufzeichnungsnummer" })
      }
      finally {
        validating.value = false
      }
    }

    // Daten beim Laden der Seite abrufen
    onMounted(() => {
      commentStore.fetchUserSessions();
    });

    return {
      commentStore,
      manualSessionId,
      validating,
      hasValidationError,
      columns,
      sessions,
      formatDate,
      getRoleMember,
      selectSession,
      validateAndSelect
    };
  }
});
</script>

<style scoped>
.wrap-description {
  white-space: normal;    /* Zeilenumbruch erlauben */
  word-break: break-word;
  text-align: left;
}

</style>
