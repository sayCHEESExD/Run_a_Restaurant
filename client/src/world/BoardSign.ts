import { CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

const FONT = '"Grandstander", "Fredoka", "Baloo 2", "Segoe UI", system-ui, sans-serif';

export interface BoardRow {
  readonly name: string;
  readonly value: string;
}

/**
 * A LEADERBOARD in the plaza: a cream board with a bold title ("Cash
 * Leaderboard!"), a subtitle and the top ten, painted on a canvas. Redrawn
 * only when what it shows changes.
 */
export class BoardSign {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private signature = '';

  constructor(
    width: number,
    height: number,
    private readonly title: string,
    private readonly subtitle: string,
  ) {
    this.canvas.width = 512;
    this.canvas.height = Math.round((512 * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.mesh = new Mesh(new PlaneGeometry(width, height), this.material);
    this.set([]);
  }

  set(rows: readonly BoardRow[]): void {
    const signature = rows.map((r) => `${r.name}|${r.value}`).join('\n');
    if (signature === this.signature && this.signature !== '') return;
    this.signature = signature || ' ';
    const ctx = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = '#fff8ea';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8a46a';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    const text = (value: string, x: number, y: number, size: number, fill: string, stroke: string, align: CanvasTextAlign = 'center', max = w - 40): void => {
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      if (stroke) {
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = stroke;
        ctx.strokeText(value, x, y, max);
      }
      ctx.fillStyle = fill;
      ctx.fillText(value, x, y, max);
    };
    text(this.title, w / 2, 44, 42, '#3aa8ff', '#ffffff');
    text(this.subtitle, w / 2, 86, 24, '#6a5040', '');
    const top = 118;
    const rowH = (h - top - 20) / 10;
    for (let i = 0; i < 10; i += 1) {
      const y = top + rowH * (i + 0.5);
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(200,164,106,0.16)';
        ctx.fillRect(18, y - rowH / 2, w - 36, rowH);
      }
      const row = rows[i];
      const medal = ['#f5b72a', '#b8c0cc', '#d8884a'][i] ?? '#6a5040';
      text(`${i + 1}`, 44, y, rowH * 0.55, medal, i < 3 ? '#ffffff' : '', 'center');
      text(row ? row.name : '-', 78, y, rowH * 0.48, '#3a2a20', '', 'left', w * 0.5);
      text(row ? row.value : '', w - 30, y, rowH * 0.48, '#2f9a3a', '', 'right', w * 0.36);
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
