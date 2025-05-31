<template>
  <q-layout>
    <q-page-container>
      <q-page padding>
        <div class="row q-col-gutter-md">
          <!-- 1 – Teilnehmerzahl setzen -->
          <div class="col-12 col-md-4">
            <q-card bordered>
              <q-card-section>
                <div class="text-h6">Gesamt-Teilnehmer</div>
                <q-input
                  v-model.number="totalInput"
                  type="number"
                  min="3"
                  label="Anzahl"
                  filled
                />
                <q-btn
                  color="primary"
                  class="q-mt-sm full-width"
                  label="Setzen"
                  @click="saveTotal"
                  :loading="saving"
                />
              </q-card-section>

              <q-separator />

              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">Gruppenverteilung</div>
                <div class="text-caption">
                  Geplant: {{ store.distribution.groups3 }} × 3er + {{ store.distribution.groups4 }} × 4er
                </div>
                <div class="text-caption">
                  Gebildet: {{ store.formed.groups3 }} × 3er + {{ store.formed.groups4 }} × 4er
                </div>
                <q-linear-progress
                  :value="store.totalFormed / store.totalPlanned"
                  color="primary"
                  class="q-mt-sm"
                />
              </q-card-section>
            </q-card>
          </div>

          <!-- 2 – Wartende Teilnehmer -->
          <div class="col-12 col-md-8">
            <q-card bordered>
              <q-card-section class="row items-center">
                <div class="text-h6">Wartende Teilnehmer</div>
                <q-badge color="orange" class="q-ml-sm">
                  {{ store.pending.length }}
                </q-badge>
                <q-space />
                <q-btn
                  dense
                  flat
                  icon="help"
                  @click="showHelp = true"
                >
                  <q-tooltip>Hilfe zur Gruppierung</q-tooltip>
                </q-btn>
                <q-toggle
                  v-model="autoRefresh"
                  label="Auto-Refresh"
                  @update:model-value="toggleAutoRefresh"
                />
                <q-btn
                  dense
                  flat
                  icon="refresh"
                  @click="store.fetchStatus"
                  :loading="store.loading"
                />
              </q-card-section>

              <q-card-section>
                <q-table
                  :rows="store.pending"
                  :columns="pendingColumns"
                  row-key="userId"
                  dense
                  :loading="store.loading"
                  :pagination="{ rowsPerPage: 10 }"
                  selection="multiple"
                  v-model:selected="selectedUsersForGroup"
                  :selected-rows-label="getSelectedString"
                >
                  <template #top-left>
                    <div v-if="selectedUsersForGroup.length > 0" class="row items-center q-gutter-sm">
                      <div class="text-subtitle2">
                        {{ selectedUsersForGroup.length }} ausgewählt
                      </div>
                      <q-btn
                        size="sm"
                        color="primary"
                        label="Gruppe bilden"
                        icon="group_add"
                        @click="createGroupFromSelection"
                        :disable="selectedUsersForGroup.length < 3 || selectedUsersForGroup.length > 4"
                      />
                      <q-btn
                        size="sm"
                        flat
                        label="Auswahl aufheben"
                        @click="selectedUsersForGroup = []"
                      />
                    </div>
                    <div v-else class="text-caption text-grey">
                      Wähle 3-4 Teilnehmer aus, um eine Gruppe zu bilden
                    </div>
                  </template>

                  <template #top-right>
                    <div class="row q-gutter-sm">
                      <q-chip
                        :color="scoreDistribution.low > 0 ? 'red' : 'grey'"
                        text-color="white"
                        icon="person"
                      >
                        Score 0-2: {{ scoreDistribution.low }}
                      </q-chip>
                      <q-chip
                        :color="scoreDistribution.mid > 0 ? 'orange' : 'grey'"
                        text-color="white"
                        icon="person"
                      >
                        Score 3-5: {{ scoreDistribution.mid }}
                      </q-chip>
                      <q-chip
                        :color="scoreDistribution.high > 0 ? 'green' : 'grey'"
                        text-color="white"
                        icon="person"
                      >
                        Score 6-8: {{ scoreDistribution.high }}
                      </q-chip>
                    </div>
                  </template>

                  <template #body-cell-score="props">
                    <q-td>
                      <q-badge
                        :color="getScoreColor(props.row.score)"
                        :label="props.row.score"
                      />
                    </q-td>
                  </template>

                  <template #no-data>
                    <div class="full-width text-center q-pa-md text-grey">
                      Keine wartenden Teilnehmer
                    </div>
                  </template>
                </q-table>
              </q-card-section>
            </q-card>
          </div>

          <!-- 3 – Gebildete Gruppen -->
          <div class="col-12">
            <q-card bordered>
              <q-card-section class="row items-center">
                <div class="text-h6">Gebildete Gruppen</div>
                <q-badge color="green" class="q-ml-sm">
                  {{ store.groups.length }}
                </q-badge>
                <q-space />
              </q-card-section>

              <q-card-section>
                <div class="row q-col-gutter-md">
                  <div
                    v-for="group in store.groups"
                    :key="group.groupId"
                    class="col-12 col-sm-6 col-md-4"
                  >
                    <q-card bordered>
                      <q-card-section>
                        <div class="row items-center">
                          <div class="text-h6">Gruppe {{ group.groupId }}</div>
                          <q-space />
                          <q-badge :label="`${group.size} Mitglieder`" />
                        </div>
                        <div class="text-caption text-grey">
                          Aufgabe {{ group.taskId }}
                        </div>
                      </q-card-section>

                      <q-separator />

                      <q-card-section>
                        <q-list dense>
                          <q-item
                            v-for="member in group.members"
                            :key="member.userId"
                            class="q-pa-xs"
                          >
                            <q-item-section avatar>
                              <q-avatar
                                :color="getRoleColor(member.collabRoleId)"
                                text-color="white"
                                size="sm"
                              >
                                {{ member.collabRoleId }}
                              </q-avatar>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>{{ member.nickname || `User ${member.userId}` }}</q-item-label>
                              <q-item-label caption>{{ getRoleName(member.collabRoleId) }}</q-item-label>
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- 4 – Manuelle Gruppierung Dialog -->
        <q-dialog v-model="showManual" persistent>
          <q-card style="min-width: 500px">
            <q-card-section class="row items-center">
              <div class="text-h6">Gruppe erstellen</div>
              <q-space />
              <q-btn icon="close" flat round dense v-close-popup @click="resetDialog" />
            </q-card-section>

            <q-separator />

            <q-card-section>
              <q-input
                v-model.number="newGroupId"
                label="Gruppen-ID"
                type="number"
                filled
                class="q-mb-md"
              />

              <div class="text-subtitle2 q-mb-sm">Mitglieder und Rollen</div>
              <div class="text-caption text-grey q-mb-md">
                Die Rollen wurden automatisch basierend auf den Scores zugewiesen. Du kannst sie bei Bedarf anpassen.
              </div>

              <q-list bordered separator>
                <q-item v-for="userId in selectedUsers" :key="userId">
                  <q-item-section avatar>
                    <q-avatar
                      :color="getRoleColor(roleAssignments[userId])"
                      text-color="white"
                    >
                      {{ roleAssignments[userId] + 1 }}
                    </q-avatar>
                  </q-item-section>

                  <q-item-section>
                    <q-item-label>
                      {{ getUserDetails(userId).nickname || `User ${userId}` }}
                    </q-item-label>
                    <q-item-label caption>
                      Score: {{ getUserDetails(userId).score }}
                    </q-item-label>
                  </q-item-section>

                  <q-item-section side>
                    <q-select
                      v-model="roleAssignments[userId]"
                      :options="roleOptions"
                      label="Rolle"
                      dense
                      filled
                      emit-value
                      map-options
                      style="min-width: 200px"
                    />
                  </q-item-section>
                </q-item>
              </q-list>

              <q-banner v-if="!isValidRoleAssignment" class="q-mt-md bg-warning text-white">
                <template #avatar>
                  <q-icon name="warning" />
                </template>
                Jede Rolle sollte nur einmal vergeben werden!
              </q-banner>
            </q-card-section>

            <q-separator />

            <q-card-actions align="right">
              <q-btn flat label="Abbrechen" @click="cancelDialog" />
              <q-btn
                color="primary"
                label="Gruppe erstellen"
                @click="saveManual"
                :disable="!isValidRoleAssignment"
              />
            </q-card-actions>
          </q-card>
        </q-dialog>

        <!-- 5 – Hilfe Dialog -->
        <q-dialog v-model="showHelp">
          <q-card style="max-width: 600px">
            <q-card-section>
              <div class="text-h6">Anleitung zur Gruppenbildung</div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="q-mb-md">
                <div class="text-subtitle2 q-mb-sm">📋 Automatische Gruppierung</div>
                <div class="text-body2">
                  Das System bildet automatisch Gruppen, wenn genügend Teilnehmer mit unterschiedlichen Scores vorhanden sind (niedrig: 0-2, mittel: 3-5, hoch: 6-8).
                </div>
              </div>

              <div class="q-mb-md">
                <div class="text-subtitle2 q-mb-sm">👥 Manuelle Gruppierung</div>
                <ol class="text-body2">
                  <li>Wähle 3-4 Teilnehmer in der Tabelle aus (Checkboxen)</li>
                  <li>Klicke auf "Gruppe bilden"</li>
                  <li>Überprüfe/ändere die Rollenzuweisung im Dialog</li>
                  <li>Bestätige mit "Gruppe erstellen"</li>
                </ol>
              </div>

              <div class="q-mb-md">
                <div class="text-subtitle2 q-mb-sm">🎭 Rollen</div>
                <ul class="text-body2">
                  <li><strong>Ergebnisverantwortlicher:</strong> Niedrigster Score (0-2)</li>
                  <li><strong>Kommentar:</strong> Mittlerer Score (3-5)</li>
                  <li><strong>Gesprächsleitung:</strong> Höchster Score (6-8)</li>
                  <li><strong>Zeitwächter:</strong> 4. Person (beliebiger Score)</li>
                </ul>
              </div>

              <div>
                <div class="text-subtitle2 q-mb-sm">⚙️ Teilnehmerzahl</div>
                <div class="text-body2">
                  Setze die erwartete Gesamtteilnehmerzahl, damit das System die optimale Verteilung von 3er- und 4er-Gruppen berechnen kann.
                </div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-actions align="right">
              <q-btn flat label="Schließen" color="primary" v-close-popup />
            </q-card-actions>
          </q-card>
        </q-dialog>

        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <q-btn
            round
            color="primary"
            icon="add"
            @click="openManualDialog"
            size="lg"
          >
            <q-tooltip>Neue Gruppe manuell erstellen</q-tooltip>
          </q-btn>
        </q-page-sticky>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useGroupingAdminStore, type WaitingUser } from "stores/groupingAdminStore";
import { QTableColumn } from "quasar";
import { useQuasar } from "quasar";

const $q = useQuasar();
const store = useGroupingAdminStore();

const totalInput = ref<number>(15);
const saving = ref(false);
const autoRefresh = ref(true);
const selectedUsersForGroup = ref<WaitingUser[]>([]);
const showHelp = ref(false);

async function saveTotal() {
  try {
    saving.value = true;
    await store.setTotal(totalInput.value);
    $q.notify({
      type: "positive",
      message: "Teilnehmerzahl gesetzt",
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Fehler beim Setzen der Teilnehmerzahl",
    });
  } finally {
    saving.value = false;
  }
}

function toggleAutoRefresh(value: boolean) {
  if (value) {
    store.startAutoRefresh(3000);
  } else {
    store.stopAutoRefresh();
  }
}

onMounted(() => {
  store.fetchStatus().then(() => {
    totalInput.value = store.total || 15;
  });
  if (autoRefresh.value) {
    store.startAutoRefresh(3000);
  }
});

onUnmounted(() => {
  store.stopAutoRefresh();
});

/* === Tabelle für wartende Teilnehmer === */
const pendingColumns: QTableColumn<WaitingUser>[] = [
  {
    name: "userId",
    label: "User ID",
    field: "userId",
    align: "left",
    sortable: true,
  },
  {
    name: "nickname",
    label: "Nickname",
    field: "nickname",
    align: "left",
    sortable: true,
  },
  {
    name: "taskId",
    label: "Aufgabe",
    field: "taskId",
    align: "center",
    sortable: true,
  },
  {
    name: "score",
    label: "Score",
    field: "score",
    align: "center",
    sortable: true,
  },
];

/* === Hilfsfunktionen === */
function getSelectedString(numberOfRows: number) {
  return `${numberOfRows} Teilnehmer ausgewählt`;
}

function getScoreColor(score: number): string {
  if (score <= 2) return "red";
  if (score <= 5) return "orange";
  return "green";
}

function getRoleColor(roleId: number): string {
  const colors = ["red", "orange", "green", "blue"];
  return colors[roleId] || "grey";
}

function getRoleName(roleId: number): string {
  const roles = [
    "Ergebnisverantwortlicher",
    "Kommentar",
    "Gesprächsleitung",
    "Zeitwächter",
  ];
  return roles[roleId] || "Unbekannt";
}

/* === Manueller Dialog === */
const showManual = ref(false);
const newGroupId = ref<number>(100);
const selectedUsers = ref<number[]>([]);
const roleAssignments = ref<Record<number, number>>({});

function createGroupFromSelection() {
  if (selectedUsersForGroup.value.length < 3 || selectedUsersForGroup.value.length > 4) {
    $q.notify({
      type: "warning",
      message: "Bitte wähle 3 oder 4 Teilnehmer aus",
    });
    return;
  }

  // Sortiere Benutzer nach Score für automatische Rollenzuweisung
  const sortedUsers = [...selectedUsersForGroup.value].sort((a, b) => a.score - b.score);

  // Automatische Rollenzuweisung basierend auf Score
  selectedUsers.value = sortedUsers.map(u => u.userId);
  roleAssignments.value = {};
  sortedUsers.forEach((user, index) => {
    roleAssignments.value[user.userId] = index;
  });

  // Generiere neue Gruppen-ID
  newGroupId.value = Math.max(...store.groups.map(g => g.groupId), 99) + 1;

  // Zeige Dialog mit vorausgefüllten Werten
  showManual.value = true;
}

// const availableUserOptions = computed(() => {
//   return store.pending.map(user => ({
//     label: `${user.nickname} (ID: ${user.userId}, Score: ${user.score})`,
//     value: user.userId,
//   }));
// });

const isValidRoleAssignment = computed(() => {
  const roles = Object.values(roleAssignments.value);
  const uniqueRoles = new Set(roles);
  return roles.length === uniqueRoles.size;
});

const scoreDistribution = computed(() => {
  const low = store.pending.filter(u => u.score <= 2).length;
  const mid = store.pending.filter(u => u.score >= 3 && u.score <= 5).length;
  const high = store.pending.filter(u => u.score >= 6).length;
  return { low, mid, high };
});

const roleOptions = [
  { label: "Ergebnisverantwortlicher (Score 0-2)", value: 0 },
  { label: "Kommentar (Score 3-5)", value: 1 },
  { label: "Gesprächsleitung (Score 6-8)", value: 2 },
  { label: "Zeitwächter (4. Person)", value: 3 },
];

// function getUserNickname(userId: number): string {
//   const user = store.pending.find(u => u.userId === userId);
//   return user?.nickname || `User ${userId}`;
// }

function getUserDetails(userId: number) {
  return store.pending.find(u => u.userId === userId) || { nickname: "", score: 0 };
}

function resetDialog() {
  selectedUsers.value = [];
  roleAssignments.value = {};
  selectedUsersForGroup.value = [];
}

function cancelDialog() {
  resetDialog();
  showManual.value = false;
}

function openManualDialog() {
  resetDialog();
  newGroupId.value = Math.max(...store.groups.map(g => g.groupId), 99) + 1;
  showManual.value = true;
}

async function saveManual() {
  try {
    const userIds = selectedUsers.value;
    const roleIds = userIds.map(uid => roleAssignments.value[uid]);

    await store.manualOverride(newGroupId.value, userIds, roleIds);

    $q.notify({
      type: "positive",
      message: "Gruppe erfolgreich erstellt",
    });

    resetDialog();
    showManual.value = false;
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Fehler beim Erstellen der Gruppe",
    });
  }
}
</script>

<style scoped>
.q-table {
  max-height: 400px;
}
</style>
