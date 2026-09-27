{{-- Blade (Laravel). {{ }} escapes; @json uses JSON_HEX_TAG, so it is safe inside <script>. --}}
@extends('layouts.app')

@section('body')
  @if (session('flash'))<nx-card title="Saved"><p>{{ session('flash') }}</p></nx-card>@endif

  <nx-grid id="users" title="Users" search striped columns="{{ json_encode($columns) }}">
    <script type="application/json" data-nx-config>{"data": @json($users)}</script>
  </nx-grid>

  <nx-card title="Invite someone">
    <form method="post" action="{{ route('users.store') }}">
      @csrf
      <nx-form columns="2">
        <nx-textfield name="name" label="Name" value="{{ old('name') }}" required></nx-textfield>
        <nx-textfield name="email" type="email" label="Email" value="{{ old('email') }}" required
                      @error('email') error-text="{{ $message }}" @enderror></nx-textfield>
        <nx-select name="role" label="Role" value="{{ old('role', 'Viewer') }}">
          @foreach ($roles as $role)<option>{{ $role }}</option>@endforeach
        </nx-select>
      </nx-form>
      <nx-button type="submit" icon="send">Invite</nx-button>
    </form>
  </nx-card>
@endsection
