import { Injectable, inject, signal } from '@angular/core';
import { Api, errorText } from '../../core/api.service';
import type { AdviceLibraryItem } from '../../core/api.types';

@Injectable({ providedIn: 'root' })
export class AdviceStore {
  private readonly api = inject(Api);
  readonly items = signal<AdviceLibraryItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async refresh() {
    this.loading.set(true);
    try {
      this.items.set(await this.api.adviceLibrary());
      this.error.set(null);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }
}
