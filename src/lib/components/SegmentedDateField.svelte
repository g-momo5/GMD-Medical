<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type Segment = 'day' | 'month' | 'year' | 'hour' | 'minute';

  export let id = '';
  export let value = '';
  export let withTime = false;
  export let disabled = false;
  export let required = false;
  export let hasError = false;
  export let ariaLabel = '';

  const dispatch = createEventDispatcher<{ blur: FocusEvent; focus: FocusEvent }>();

  const segmentLengths: Record<Segment, number> = {
    day: 2,
    month: 2,
    year: 4,
    hour: 2,
    minute: 2
  };

  const dateOrder: Segment[] = ['day', 'month', 'year'];
  const dateTimeOrder: Segment[] = ['day', 'month', 'year', 'hour', 'minute'];

  let day = '';
  let month = '';
  let year = '';
  let hour = '';
  let minute = '';

  let dayInput: HTMLInputElement | undefined;
  let monthInput: HTMLInputElement | undefined;
  let yearInput: HTMLInputElement | undefined;
  let hourInput: HTMLInputElement | undefined;
  let minuteInput: HTMLInputElement | undefined;

  let lastSyncedValue = '';

  let segmentOrder: Segment[] = dateOrder;
  $: segmentOrder = withTime ? dateTimeOrder : dateOrder;

  $: if (value !== lastSyncedValue) {
    syncSegments(value);
    lastSyncedValue = value;
  }

  function sanitizeSegment(segment: Segment, rawValue: string): string {
    return rawValue.replace(/\D/g, '').slice(0, segmentLengths[segment]);
  }

  function getSegmentValue(segment: Segment): string {
    switch (segment) {
      case 'day':
        return day;
      case 'month':
        return month;
      case 'year':
        return year;
      case 'hour':
        return hour;
      case 'minute':
        return minute;
    }
  }

  function setSegmentValue(segment: Segment, nextValue: string): void {
    switch (segment) {
      case 'day':
        day = nextValue;
        return;
      case 'month':
        month = nextValue;
        return;
      case 'year':
        year = nextValue;
        return;
      case 'hour':
        hour = nextValue;
        return;
      case 'minute':
        minute = nextValue;
        return;
    }
  }

  function getSegmentInput(segment: Segment): HTMLInputElement | undefined {
    switch (segment) {
      case 'day':
        return dayInput;
      case 'month':
        return monthInput;
      case 'year':
        return yearInput;
      case 'hour':
        return hourInput;
      case 'minute':
        return minuteInput;
    }
  }

  function focusSegment(segment: Segment): void {
    const input = getSegmentInput(segment);
    if (!input) return;

    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  function focusNextSegment(segment: Segment): void {
    const currentIndex = segmentOrder.indexOf(segment);
    const nextSegment = segmentOrder[currentIndex + 1];
    if (!nextSegment) return;
    focusSegment(nextSegment);
  }

  function focusPreviousSegment(segment: Segment): void {
    const currentIndex = segmentOrder.indexOf(segment);
    const previousSegment = segmentOrder[currentIndex - 1];
    if (!previousSegment) return;
    focusSegment(previousSegment);
  }

  function syncSegments(nextValue: string): void {
    if (withTime) {
      const match = nextValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) {
        day = '';
        month = '';
        year = '';
        hour = '';
        minute = '';
        return;
      }
      year = match[1];
      month = match[2];
      day = match[3];
      hour = match[4];
      minute = match[5];
      return;
    }

    const match = nextValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      day = '';
      month = '';
      year = '';
      return;
    }

    year = match[1];
    month = match[2];
    day = match[3];
  }

  function buildDateValue(): string {
    if (
      day.length !== segmentLengths.day ||
      month.length !== segmentLengths.month ||
      year.length !== segmentLengths.year
    ) {
      return '';
    }

    const dayValue = Number(day);
    const monthValue = Number(month);
    const yearValue = Number(year);

    if (
      Number.isNaN(dayValue) ||
      Number.isNaN(monthValue) ||
      Number.isNaN(yearValue) ||
      dayValue < 1 ||
      monthValue < 1 ||
      monthValue > 12 ||
      yearValue < 1
    ) {
      return '';
    }

    const date = new Date(yearValue, monthValue - 1, dayValue);
    const isValidDate =
      date.getFullYear() === yearValue &&
      date.getMonth() === monthValue - 1 &&
      date.getDate() === dayValue;

    if (!isValidDate) {
      return '';
    }

    return `${year}-${month}-${day}`;
  }

  function buildDateTimeValue(): string {
    if (
      day.length !== segmentLengths.day ||
      month.length !== segmentLengths.month ||
      year.length !== segmentLengths.year ||
      hour.length !== segmentLengths.hour ||
      minute.length !== segmentLengths.minute
    ) {
      return '';
    }

    const dayValue = Number(day);
    const monthValue = Number(month);
    const yearValue = Number(year);
    const hourValue = Number(hour);
    const minuteValue = Number(minute);

    if (
      Number.isNaN(dayValue) ||
      Number.isNaN(monthValue) ||
      Number.isNaN(yearValue) ||
      Number.isNaN(hourValue) ||
      Number.isNaN(minuteValue) ||
      dayValue < 1 ||
      monthValue < 1 ||
      monthValue > 12 ||
      yearValue < 1 ||
      hourValue < 0 ||
      hourValue > 23 ||
      minuteValue < 0 ||
      minuteValue > 59
    ) {
      return '';
    }

    const date = new Date(yearValue, monthValue - 1, dayValue, hourValue, minuteValue);
    const isValidDate =
      date.getFullYear() === yearValue &&
      date.getMonth() === monthValue - 1 &&
      date.getDate() === dayValue &&
      date.getHours() === hourValue &&
      date.getMinutes() === minuteValue;

    if (!isValidDate) {
      return '';
    }

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function syncComposedValue(): void {
    const nextValue = withTime ? buildDateTimeValue() : buildDateValue();
    if (nextValue === value) return;
    value = nextValue;
    lastSyncedValue = nextValue;
  }

  function handleSegmentInput(segment: Segment, event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const nextValue = sanitizeSegment(segment, target.value);
    setSegmentValue(segment, nextValue);
    target.value = nextValue;
    syncComposedValue();

    if (nextValue.length === segmentLengths[segment]) {
      focusNextSegment(segment);
    }
  }

  function handleSegmentKeyDown(segment: Segment, event: KeyboardEvent): void {
    const target = event.currentTarget as HTMLInputElement;
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? 0;
    const currentValue = getSegmentValue(segment);

    if (event.key === 'Backspace' && currentValue.length === 0) {
      event.preventDefault();
      focusPreviousSegment(segment);
      return;
    }

    if (event.key === 'ArrowLeft' && selectionStart === 0 && selectionEnd === 0) {
      event.preventDefault();
      focusPreviousSegment(segment);
      return;
    }

    if (
      event.key === 'ArrowRight' &&
      selectionStart === currentValue.length &&
      selectionEnd === currentValue.length
    ) {
      event.preventDefault();
      focusNextSegment(segment);
    }
  }

  function forwardFocus(event: FocusEvent): void {
    dispatch('focus', event);
  }

  function forwardBlur(event: FocusEvent): void {
    dispatch('blur', event);
  }
</script>

<div
  class="segmented-field"
  class:error={hasError}
  role="group"
  aria-label={ariaLabel || (withTime ? 'Data e ora' : 'Data')}
>
  <div class="segmented-group">
    <input
      {id}
      bind:this={dayInput}
      class="segmented-input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength={segmentLengths.day}
      placeholder="GG"
      aria-label="Giorno"
      value={day}
      {disabled}
      {required}
      on:input={(event) => handleSegmentInput('day', event)}
      on:keydown={(event) => handleSegmentKeyDown('day', event)}
      on:focus={forwardFocus}
      on:blur={forwardBlur}
    />
    <span class="segmented-separator" aria-hidden="true">/</span>
    <input
      bind:this={monthInput}
      class="segmented-input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength={segmentLengths.month}
      placeholder="MM"
      aria-label="Mese"
      value={month}
      {disabled}
      on:input={(event) => handleSegmentInput('month', event)}
      on:keydown={(event) => handleSegmentKeyDown('month', event)}
      on:focus={forwardFocus}
      on:blur={forwardBlur}
    />
    <span class="segmented-separator" aria-hidden="true">/</span>
    <input
      bind:this={yearInput}
      class="segmented-input segmented-input-year"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength={segmentLengths.year}
      placeholder="AAAA"
      aria-label="Anno"
      value={year}
      {disabled}
      on:input={(event) => handleSegmentInput('year', event)}
      on:keydown={(event) => handleSegmentKeyDown('year', event)}
      on:focus={forwardFocus}
      on:blur={forwardBlur}
    />
  </div>

  {#if withTime}
    <div class="segmented-group">
      <input
        bind:this={hourInput}
        class="segmented-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength={segmentLengths.hour}
        placeholder="HH"
        aria-label="Ora"
        value={hour}
        {disabled}
        on:input={(event) => handleSegmentInput('hour', event)}
        on:keydown={(event) => handleSegmentKeyDown('hour', event)}
        on:focus={forwardFocus}
        on:blur={forwardBlur}
      />
      <span class="segmented-separator" aria-hidden="true">:</span>
      <input
        bind:this={minuteInput}
        class="segmented-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength={segmentLengths.minute}
        placeholder="MM"
        aria-label="Minuti"
        value={minute}
        {disabled}
        on:input={(event) => handleSegmentInput('minute', event)}
        on:keydown={(event) => handleSegmentKeyDown('minute', event)}
        on:focus={forwardFocus}
        on:blur={forwardBlur}
      />
    </div>
  {/if}
</div>

<style>
  .segmented-field {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    box-sizing: border-box;
    transition: all var(--transition-fast);
  }

  .segmented-group {
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
  }

  .segmented-input {
    width: 2.25rem;
    border: none;
    outline: none;
    text-align: center;
    background: transparent;
    color: var(--color-text);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    padding: 0;
  }

  .segmented-input-year {
    width: 3.85rem;
  }

  .segmented-input::placeholder {
    color: var(--color-text-tertiary);
    opacity: 1;
  }

  .segmented-separator {
    color: var(--color-text-secondary);
    font-weight: 600;
    user-select: none;
    margin: 0 -1px;
  }

  .segmented-field:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .segmented-field.error {
    border-color: var(--color-error);
  }

  .segmented-field.error:focus-within {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  @media (max-width: 640px) {
    .segmented-field {
      flex-wrap: wrap;
      justify-content: flex-start;
    }
  }
</style>
