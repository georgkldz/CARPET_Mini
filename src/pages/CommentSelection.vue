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
                  <q-td key="owner"   :props="props" class="text-center">{{ props.row.owner }}</q-td>
                  <q-td key="scribe"  :props="props" class="text-center">{{ props.row.scribe }}</q-td>
                  <q-td key="lead"    :props="props" class="text-center">{{ props.row.lead }}</q-td>
                  <q-td key="timer"   :props="props" class="text-center">{{ props.row.timer }}</q-td>
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
      { name: "sessionId", label: "Aufzeichnung Nr.", field: "sessionId", sortable: true, style: "width: 10%",   align: "center" },
      { name: "taskId",     label: "Aufgabe Nr.",      field: "taskId",     sortable: true, style: "width: 10%" ,   align: "center" },
      { name: "taskDescription", label: "Aufgabenstellung", field: "taskDescription", style: "width: 20%", align: "left", classes: "q-pa-xs wrap-description" },
      { name: "timestamp", label: "Datum", field: "timestamp", sortable: true,   align: "center"  },
      { name: "owner",   label: "Ergeb.-verantw.",    field: "owner",   align: "center" },
      { name: "scribe",  label: "Kommentarprot.",      field: "scribe",  align: "center" },
      { name: "lead",    label: "Gesprächsleiter",     field: "lead",    align: "center" },
      { name: "timer",   label: "Zeitwächter",         field: "timer",   align: "center" }
    ];

    // Sessions aus dem Store abrufen
    const sessions = computed(() => {
      const out = []

      for (const s of commentStore.availableSessions) {
        // 👉 Logge hier die rohen Daten jeder Session
        console.debug("DEBUG Session ${s.sessionId}: members=",s.members," description=", s.taskDescription  )  // ✅ so siehst du alle Member-Objekte und Beschreibungen :contentReference[oaicite:0]{index=0}

        let owner  = "–"
        let scribe = "–"
        let lead   = "–"
        let timer  = "–"

        for (const m of s.members) {
          console.debug("DEBUG Mapping role ${m.roleId} →", m.nickname || m.userId  )  // ✅ hier siehst du jeden Role­-Zuordnungsschritt :contentReference[oaicite:1]{index=1}

          if (m.roleId === 0) owner  = m.nickname || m.userId
          if (m.roleId === 1) scribe = m.nickname || m.userId
          if (m.roleId === 2) lead   = m.nickname || m.userId
          if (m.roleId === 3) timer  = m.nickname || m.userId
        }

        out.push({
          sessionId:       s.sessionId,
          taskId:          s.taskId,
          taskDescription: s.taskDescription,
          timestamp:       s.timestamp,
          owner,
          scribe,
          lead,
          timer
        })
        // 👉 Optional: Logge das fertige Mapping-Objekt
        console.debug("DEBUG Mapped row:", out[out.length - 1])
      }

      return out
    })


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
    const selectSession = async (sessionId) => {
      commentStore.setCurrentSessionId(sessionId);
      await commentStore.fetchCommentsForSession(sessionId);
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
