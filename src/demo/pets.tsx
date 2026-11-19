/**
 * The Pets page: a list that lives on a server. The client is made from the server's own OpenAPI document, so there
 * is no list of URLs, fields or rules here. The grid sorts, searches and pages through the server, and the form is
 * checked by the rules the document declares. (The "server" is a small one that lives in the page: see
 * examples/showcase/mock-server.ts.)
 */
import { NX, Button, DataGrid, Drawer, DrawerFooter, Input, Pagination, Select, Switch, VStack, type NXGrid } from '@/index';
import { installMockServer } from '../../examples/showcase/mock-server';

type Pet = { id?: number; name: string; species: string; age: number; adopted: boolean };

let ready: Promise<any> | null = null;

/** Start the in-page server and read its OpenAPI document, once */
export function petsApi(): Promise<any> {
  return (ready ??= (async () => {
    installMockServer();
    return NX.openapi(new URL('__mock__/openapi.json', location.href).href);
  })().catch(error => { ready = null; throw error; }));
}

/** What the route's loader hands the page: the client, and a store that has loaded its first page */
export async function loadPets() {
  const api = await petsApi();
  const store = api.store('pets', { pageSize: 10 });
  await store.load();
  return { api, store };
}

export const PetsPage = ({ api, store, Page }: { api: any; store: any; Page: (props: any) => any }) => {
  const Model = api.model('pets');
  const grid = { current: null as NXGrid<Pet> | null };
  const drawer = { current: null as (HTMLElement & { open(): void; close(): void }) | null };
  const name = { current: null as any }, species = { current: null as any }, age = { current: null as any }, adopted = { current: null as any };
  const save = { current: null as any }, erase = { current: null as any }, status = { current: null as HTMLElement | null };
  const touched = new Set<string>();
  let editing: any = null;

  const values = () => ({ name: name.current.value ?? '', species: species.current.value || undefined, age: age.current.value, adopted: !!adopted.current.checked });

  /** Check the form against the document's rules; show a message for each field you have touched */
  const check = () => {
    const { errors, valid } = (editing ?? new Model({})).constructor.validate(values(), 'en');
    for (const [field, ref] of [['name', name], ['species', species], ['age', age]] as const) {
      const message = touched.has(field) ? errors[field]?.[0] ?? '' : '';
      if (message) ref.current.setAttribute('error-text', message); else ref.current.removeAttribute('error-text');
    }
    if (valid) save.current.removeAttribute('disabled'); else save.current.setAttribute('disabled', '');
    return valid;
  };

  const open = (pet?: Pet) => {
    editing = new Model(pet ?? {});
    touched.clear();
    drawer.current!.setAttribute('title', pet ? `Edit ${pet.name}` : 'Add a pet');
    name.current.value = pet?.name ?? '';
    species.current.value = pet?.species ?? 'cat';
    age.current.value = String(pet?.age ?? 1);
    adopted.current.checked = !!pet?.adopted;
    erase.current.style.display = pet ? '' : 'none';
    check();
    drawer.current!.open();
  };

  const refresh = () => store.loadPage(store.getCurrentPage()).catch((e: Error) => NX.toast.error('Could not load', { description: e.message }));

  const onSave = async () => {
    ['name', 'species', 'age'].forEach(f => touched.add(f));
    if (!check()) return;
    editing.set(values());
    save.current.setLoading?.(true);
    try {
      await editing.save();
      drawer.current!.close();
      NX.toast.success(`Saved ${editing.get('name')}`, { description: `Pet #${editing.id}` });
      await (editing.id === undefined ? store.loadPage(1) : refresh());
    } catch (e) {
      NX.toast.error('The server said no', { description: (e as Error).message });
    } finally {
      save.current.setLoading?.(false);
    }
  };

  const onDelete = async () => {
    if (!(await NX.confirm('This cannot be undone.', { title: `Remove ${editing.get('name')}?`, confirmText: 'Remove', danger: true }))) return;
    try {
      await editing.erase();
      drawer.current!.close();
      NX.toast.success(`Removed ${editing.get('name')}`);
      await refresh();
    } catch (e) {
      NX.toast.error('Could not remove it', { description: (e as Error).message });
    }
  };

  const range = () => {
    const page = store.getCurrentPage(), size = 10, total = store.getTotalCount();
    return total ? `Showing ${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}` : 'Nothing here';
  };

  const page = (
    <Page
      title="Pets"
      description="A list that lives on a server. The client was made from the server's OpenAPI document: the grid sorts, searches and pages through it, and the form checks the document's rules."
      actions={<Button id="add-pet" icon="plus" onClick={() => open()}>Add pet</Button>}
    >
      <VStack gap={12}>
        <VStack gap={12}>
          <DataGrid
            ref={grid}
            id="pets-grid"
            store={store}
            search
            striped
            columns={[
              { field: 'id', header: 'Id', width: 70, sortable: true },
              { field: 'name', header: 'Name', sortable: true },
              { field: 'species', header: 'Species', type: 'badge', width: 120, sortable: true, badges: { cat: 'info', dog: 'success', rabbit: 'warning' } },
              { field: 'age', header: 'Age', type: 'number', width: 90, sortable: true },
              { field: 'adopted', header: 'Adopted', type: 'boolean', width: 110 },
              { field: 'born', header: 'Born', type: 'date', width: 130, sortable: true }
            ]}
            onRowClick={(e: CustomEvent) => open(e.detail.row)}
          />
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem">
            <span ref={status} class="muted" role="status" id="pets-status">{range()}</span>
            <Pagination id="pets-pager" total={store.getTotalCount()} pageSize={10} page={store.getCurrentPage()}
                        onPageChange={(e: CustomEvent) => { void store.loadPage(e.detail.page); }} />
          </div>
        </VStack>
      </VStack>

      <Drawer ref={drawer} title="Add a pet" description="The rules come from the server's document and are checked as you type.">
        <VStack gap={16}>
          <Input ref={name} id="pet-name" name="name" label="Name" placeholder="2 to 20 characters" onInput={() => { touched.add('name'); check(); }} />
          <Select ref={species} id="pet-species" name="species" label="Species" options={['cat', 'dog', 'rabbit']} onChange={() => { touched.add('species'); check(); }} />
          <Input ref={age} id="pet-age" name="age" type="number" label="Age" helperText="0 to 30" onInput={() => { touched.add('age'); check(); }} />
          <Switch ref={adopted} id="pet-adopted" name="adopted" label="Adopted" />
        </VStack>
        <DrawerFooter>
          <Button ref={erase} id="pet-delete" variant="danger" icon="trash" onClick={onDelete}>Remove</Button>
          <Button variant="outline" onClick={() => drawer.current!.close()}>Cancel</Button>
          <Button ref={save} id="pet-save" onClick={onSave}>Save</Button>
        </DrawerFooter>
      </Drawer>
    </Page>
  );

  // Keep the pager and the count in step with the server's answers
  store.on('load', () => {
    const pager = document.getElementById('pets-pager');
    pager?.setAttribute('total', String(store.getTotalCount()));
    pager?.setAttribute('page', String(store.getCurrentPage()));
    if (status.current) status.current.textContent = range();
  });
  return page;
};
