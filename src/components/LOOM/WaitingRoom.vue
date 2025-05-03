<template>
  <div class="waiting-room">
    <div class="waiting-container">
      <div class="spinner-container">
        <q-spinner-dots color="primary" size="80px" />
      </div>
      <h2 class="title">Warte auf Gruppenzuweisung</h2>
      <p class="description">
        Deine Antworten wurden ausgewertet und wir suchen passende
        Teammitglieder für dich. Bitte warte einen Moment, bis die
        Gruppenzuweisung abgeschlossen ist.
      </p>
      <div class="status-info">
        <p v-if="proficiencyLevel !== null">
          <strong>Dein Leistungsniveau:</strong> {{ proficiencyLevelText }}
        </p>
        <p><strong>Status:</strong> {{ waitingStatus }}</p>
        <p class="waiting-time">Wartezeit: {{ formattedWaitingTime }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useUserStore } from "stores/userStore";
import { useTaskGraphStore } from "stores/taskGraphStore";

const userStore = useUserStore();
const taskGraphStore = useTaskGraphStore();

const waitingStatus = ref("Warte auf Zuweisung...");
const waitingStartTime = ref(Date.now());
const currentTime = ref(Date.now());
const timerInterval = ref<number | null>(null);

// Proficiency-Level des Benutzers ermitteln
const proficiencyLevel = computed(() => {
  const taskId = taskGraphStore.getCurrentTaskId;
  if (!taskId) return null;
  return userStore.getProficiencyByTaskId(taskId);
});

// Textdarstellung des Proficiency-Levels
const proficiencyLevelText = computed(() => {
  if (proficiencyLevel.value === null) return "Unbekannt";

  const score = proficiencyLevel.value;
  if (score <= 2) return "Grundlegend (0-2)";
  if (score <= 5) return "Mittel (3-5)";
  return "Fortgeschritten (6-8)";
});

// Formatierte Wartezeit
const formattedWaitingTime = computed(() => {
  const elapsedSeconds = Math.floor(
    (currentTime.value - waitingStartTime.value) / 1000,
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// Timer für die Wartezeit
onMounted(() => {
  timerInterval.value = window.setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerInterval.value !== null) {
    clearInterval(timerInterval.value);
  }
});
</script>

<style scoped>
.waiting-room {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background-color: #f5f7fa;
}

.waiting-container {
  max-width: 500px;
  padding: 2rem;
  text-align: center;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.spinner-container {
  margin-bottom: 1.5rem;
}

.title {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: #333;
}

.description {
  margin-bottom: 2rem;
  color: #666;
  line-height: 1.6;
}

.status-info {
  text-align: left;
  padding: 1rem;
  background-color: #f0f4f8;
  border-radius: 6px;
}

.waiting-time {
  font-weight: bold;
  margin-top: 1rem;
  font-family: monospace;
  font-size: 1.2rem;
}
</style>
