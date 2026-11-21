/**
 * The Developer page: the building blocks of an admin tool for scripts and definitions. A property grid edits a job
 * definition from a schema (a script is chosen with your own picker, fields lock and hide with the other values, the
 * server's complaints land next to their fields), and a code editor edits the script with an unsaved-changes mark.
 */
import { NX, Button, Card, CodeEditor, HStack, PropertyGrid, VStack, parseApiError, type NXCodeEditor, type NXPropertyGrid, type PropertyField } from '@/index';

const schema: PropertyField[] = [
  { name: 'name', label: 'Name', required: true, help: 'Shown in the job list. Try "taken" to see a server complaint.' },
  { name: 'kind', label: 'Kind', type: 'select', options: ['scheduled', 'on demand'], default: 'scheduled' },
  { name: 'schedule', label: 'Schedule (cron)', placeholder: '0 3 * * *', hidden: v => v.kind === 'on demand', required: true, pattern: '[0-9*/,-]+( [0-9*/,-]+){4}', help: 'Minute, hour, day, month, weekday' },
  { name: 'script', label: 'Script', type: 'reference', required: true, help: 'Chosen with your own picker: a dialog, a file browser…', readonly: v => !!v.enabled && !!v.locked,
    picker: async current => { const path = await NX.prompt('Script path', { title: 'Choose a script', defaultValue: typeof current === 'string' ? current : 'scripts/nightly.groovy' }); return path ? { value: path, text: path } : undefined; } },
  { name: 'retries', label: 'Retries', type: 'number', min: 0, max: 5, default: 0 },
  { name: 'enabled', label: 'Enabled', type: 'boolean' },
  { name: 'locked', label: 'Lock the script while enabled', type: 'boolean', hidden: v => !v.enabled },
  { name: 'settings', label: 'Settings', type: 'json', group: 'Advanced', help: 'Checked as you type' }
];

const script = `// A script, edited in the code editor.
// Tab indents; press Escape, then Tab, to leave the editor.
def run(ctx) {
  ctx.log.info("hello from \${ctx.job.name}")
  return [ok: true]
}
`;

export const DeveloperPage = ({ Page }: { Page: (props: any) => any }) => {
  const grid = { current: null as NXPropertyGrid | null };
  const editor = { current: null as NXCodeEditor | null };
  const status = { current: null as HTMLElement | null };

  const saveJob = async () => {
    const g = grid.current!;
    const { valid } = g.validate();
    if (!valid) { NX.toast.error('Fix the highlighted fields first'); return; }
    // A server that refuses the name, answering the way Spring would
    if (g.value.name === 'taken') {
      const info = parseApiError({ status: 400, response: { errors: [{ field: 'name', defaultMessage: 'A job with this name already exists' }] } });
      g.setErrors(info.fields);
      (g as any).shadowRoot.querySelector('[data-name="name"] > *')?.focus?.();
      NX.toast.error(info.message);
      return;
    }
    g.markClean();
    NX.toast.success(`Saved ${g.value.name}`);
  };

  const paint = () => { if (status.current) status.current.textContent = editor.current?.isDirty() ? 'Not saved' : 'Saved'; };

  return (
    <Page title="Developer" description="Editors for scripts and definitions: a property grid built from a schema, and a code editor that is a form field.">
      <Card title="Job definition" subtitle="A property grid: typed fields, a script chosen with your own picker, fields that lock and hide with the others.">
        <VStack gap={16}>
          <PropertyGrid ref={grid} id="job-grid" label="Job definition" schema={schema}
                        value={{ name: 'Nightly export', kind: 'scheduled', schedule: '0 3 * * *', script: 'scripts/nightly.groovy', retries: 2, enabled: true, settings: { batch: 500, notify: ['ops@example.com'] } }} />
          <HStack gap={8}>
            <Button id="job-save" onClick={saveJob}>Save job</Button>
            <Button variant="outline" onClick={() => { grid.current!.value = {}; }}>Clear</Button>
          </HStack>
        </VStack>
      </Card>

      <Card title="Script" subtitle="The code editor: line numbers, indentation, the cursor position and an unsaved-changes mark.">
        <VStack gap={12}>
          <CodeEditor ref={editor} id="script-editor" label="nightly.groovy" language="groovy" value={script} height="14rem"
                      onDirtyChange={paint} />
          <HStack gap={8} align="center">
            <Button id="script-save" onClick={() => { editor.current!.markClean(); paint(); NX.toast.success('Script saved'); }}>Save</Button>
            <Button variant="outline" onClick={() => { editor.current!.revert(); paint(); }}>Revert</Button>
            <span ref={status} id="script-status" class="muted" role="status">Saved</span>
          </HStack>
        </VStack>
      </Card>
    </Page>
  );
};
