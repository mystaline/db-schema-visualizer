<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useReportModal } from "../composables/useReportModal";
import { useModalKeyboard } from "../composables/useModalKeyboard";
import { useToast } from "../composables/useToast";
import ModalShell from "./ModalShell.vue";

const WORKER_URL = import.meta.env.VITE_REPORT_WORKER_URL as string;
const COOLDOWN_KEY = "schema_viz_last_report";
const COOLDOWN_SECONDS = 86400;

const { isOpen, close } = useReportModal();
const { toast } = useToast();

const type = ref("Bug Report");
const message = ref("");
const email = ref("");
const isSubmitting = ref(false);
const inlineError = ref("");
const cooldownHoursLeft = ref(0);

const charsLeft = computed(() => 1000 - message.value.length);
const canSubmit = computed(
  () => message.value.trim().length > 0 && charsLeft.value >= 0 && cooldownHoursLeft.value === 0 && !isSubmitting.value
);

const checkCooldown = () => {
  try {
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) { cooldownHoursLeft.value = 0; return; }
    const elapsed = Math.floor(Date.now() / 1000) - Number(last);
    const remaining = COOLDOWN_SECONDS - elapsed;
    cooldownHoursLeft.value = remaining > 0 ? Math.ceil(remaining / 3600) : 0;
  } catch {
    cooldownHoursLeft.value = 0;
  }
};

const markSubmitted = () => {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Math.floor(Date.now() / 1000)));
  } catch { /* ignore */ }
};

watch(isOpen, (val) => {
  if (val) {
    type.value = "Bug Report";
    message.value = "";
    email.value = "";
    inlineError.value = "";
    isSubmitting.value = false;
    checkCooldown();
  }
});

const handleSubmit = async () => {
  if (!canSubmit.value) return;
  isSubmitting.value = true;
  inlineError.value = "";

  const subject = `[SchemaVis] ${type.value} — ${message.value.slice(0, 60)}${message.value.length > 60 ? "…" : ""}`;
  const body = `Type: ${type.value}\n\n${message.value}\n\nReply to: ${email.value.trim() || "not provided"}`;

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "SchemaVis",
        subject,
        from_name: email.value.trim() || "Anonymous",
        message: body,
      }),
    });

    if (res.ok) {
      markSubmitted();
      close();
      toast("Report sent! Thank you.", "success");
    } else if (res.status === 429) {
      try {
        const data = await res.json();
        inlineError.value = data.error ?? "Too many reports. Try again later.";
      } catch {
        inlineError.value = "Too many reports. Try again later.";
      }
    } else {
      toast("Failed to send report. Please try again.", "error");
    }
  } catch {
    toast("Failed to send report. Check your connection.", "error");
  } finally {
    isSubmitting.value = false;
  }
};

useModalKeyboard(isOpen, {
  onEsc: () => close(),
});
</script>

<template>
  <ModalShell :is-open="isOpen" max-width="max-w-md" @close="close">
    <div class="bg-secondary-900 border border-secondary-700 rounded-3xl shadow-2xl p-8 space-y-6">
      <!-- Header -->
      <div class="space-y-1">
        <h2 class="text-lg font-black uppercase tracking-tight text-secondary-50">
          Report / Feedback
        </h2>
        <p class="text-xs text-secondary-500 font-mono">
          Your message goes directly to the developer.
        </p>
      </div>

      <!-- Cooldown banner -->
      <div
        v-if="cooldownHoursLeft > 0"
        class="px-4 py-3 rounded-xl bg-warning-500/10 border border-warning-500/30 text-warning-400 text-xs font-medium"
      >
        You can send another report in {{ cooldownHoursLeft }}h.
      </div>

      <!-- Form -->
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Type -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Type</label>
          <select
            v-model="type"
            class="w-full bg-secondary-950 border border-secondary-700 rounded-xl px-4 py-3 text-sm text-secondary-100 focus:border-primary-500 focus:outline-none transition-all focus:ring-4 focus:ring-primary-500/10"
          >
            <option>Bug Report</option>
            <option>Feature Request</option>
            <option>Other</option>
          </select>
        </div>

        <!-- Message -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Message</label>
            <span
              class="text-[10px] font-mono"
              :class="charsLeft < 0 ? 'text-danger-400' : 'text-secondary-500'"
            >{{ charsLeft }}</span>
          </div>
          <textarea
            v-model="message"
            rows="5"
            placeholder="Describe the issue or idea..."
            class="w-full bg-secondary-950 border border-secondary-700 rounded-xl px-4 py-3 text-sm text-secondary-100 focus:border-primary-500 focus:outline-none transition-all focus:ring-4 focus:ring-primary-500/10 resize-none placeholder:text-secondary-600"
            :class="cooldownHoursLeft > 0 ? 'opacity-50 cursor-not-allowed' : ''"
            :readonly="cooldownHoursLeft > 0"
          />
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
            Your Email <span class="normal-case font-normal text-secondary-600">(optional — for follow-up)</span>
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            class="w-full bg-secondary-950 border border-secondary-700 rounded-xl px-4 py-3 text-sm text-secondary-100 focus:border-primary-500 focus:outline-none transition-all focus:ring-4 focus:ring-primary-500/10 placeholder:text-secondary-600"
          />
        </div>

        <!-- Inline error (429) -->
        <p v-if="inlineError" class="text-xs text-danger-400 font-medium">{{ inlineError }}</p>

        <!-- Actions -->
        <div class="flex gap-3 pt-1">
          <button
            type="button"
            class="flex-1 py-3 rounded-xl border border-secondary-700 text-secondary-400 text-sm font-bold hover:bg-secondary-800 transition-all active:scale-95"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="!canSubmit"
            class="flex-1 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
          >
            {{ isSubmitting ? "Sending…" : "Send" }}
          </button>
        </div>
      </form>
    </div>
  </ModalShell>
</template>
