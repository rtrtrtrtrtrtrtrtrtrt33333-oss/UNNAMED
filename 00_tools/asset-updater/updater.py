"""Standalone local asset copier. No runtime integration with the website."""
from pathlib import Path
from datetime import datetime
import io
import sys
import hashlib
import json
import os
import tempfile
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

sys.path.insert(0, str(Path(__file__).resolve().parent / '_vendor'))

IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff'}


def to_png(data):
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise ValueError('Установи Pillow: python -m pip install --target 00_tools/asset-updater/_vendor -r 00_tools/asset-updater/requirements.txt') from exc
    with Image.open(io.BytesIO(data)) as image:
        if getattr(image, 'n_frames', 1) > 1:
            raise ValueError('Выбери статичное изображение: анимация и многостраничные файлы не конвертируются, чтобы не потерять кадры.')
        image.load()
        if image.format == 'PNG' and image.getexif().get(274, 1) == 1:
            return data
        oriented = ImageOps.exif_transpose(image)
        converted = oriented.convert('RGBA' if 'A' in oriented.getbands() or 'transparency' in oriented.info else 'RGB')
        output = io.BytesIO()
        converted.save(output, format='PNG')
        return output.getvalue()


ROOT = Path(__file__).resolve().parents[2]
BACKUPS = Path(__file__).resolve().parent / 'backups'
PRESETS = {
    'Фон страницы': 'assets/images/00_backgrounds-background.png',
    'Узор основного блока': 'assets/images/00_backgrounds-main-pattern.png',
    'Цвета персонажа': 'assets/data/character-colors.css',
    'Шрифты персонажа': 'assets/data/character-font.css',
    'Фон плейлиста (GIF)': 'assets/images/06_playlist-background.gif',
    'Фон Hero': 'assets/images/01_hero-profile-background.png',
    'Другой файл assets (указать путь)': '',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inside(path, parent):
    resolved = path.resolve()
    if not resolved.is_relative_to(parent.resolve()):
        raise ValueError(f'Путь выходит за разрешённую папку: {path}')
    return resolved


def atomic_write(path, data):
    # Temporary file beside the destination allows an atomic replacement.
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.asset-update-')
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def plan(root, characters, relative, source):
    relative = Path(relative)
    if relative.is_absolute() or '..' in relative.parts or not relative.parts or relative.parts[0] != 'assets':
        raise ValueError('Укажи путь внутри assets, например assets/images/00_backgrounds-background.png')
    data = source.read_bytes()
    if not data:
        raise ValueError('Исходный файл пуст.')
    if relative.suffix.lower() == '.png':
        data = to_png(data)
    elif relative.suffix.lower() == '.gif':
        from PIL import Image
        with Image.open(io.BytesIO(data)) as image:
            if image.format != 'GIF':
                raise ValueError('Для GIF-назначения выбери настоящий GIF-файл.')
            for frame in range(image.n_frames):
                image.seek(frame)
                image.load()
        # Copy original bytes: preserve frames, timing, transparency and loop settings.
    elif relative.suffix.lower() in {'.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'}:
        raise ValueError('Для картинок укажи целевой путь .png. Ссылки на старые форматы инструмент не меняет.')
    elif source.suffix.lower() != relative.suffix.lower():
        raise ValueError('Расширения не-графических файлов должны совпадать.')
    if relative.suffix.lower() == '.css':
        data.decode('utf-8-sig')
    rows = []
    for character in characters:
        character = inside(character, root)
        if character.parent.name != 'Characters':
            raise ValueError('Неверная папка персонажа.')
        target = inside(character / relative, character / 'assets')
        inside(target, root)
        if not target.is_file():
            rows.append((target, None, 'Нет файла — пропуск'))
        else:
            old = target.read_bytes()
            rows.append((target, digest(old), 'Без изменений' if old == data else 'Заменить'))
    return data, rows


def apply(root, backup_root, data, rows):
    changes = [(p, old) for p, old, action in rows if action == 'Заменить']
    if not changes:
        raise ValueError('Нет файлов для замены.')
    for path, old in changes:
        inside(path, root)
        if digest(path.read_bytes()) != old:
            raise ValueError('Файл изменился после просмотра. Построй список замен заново.')
    backup_root.mkdir(parents=True, exist_ok=True)
    batch = Path(tempfile.mkdtemp(prefix=datetime.now().strftime('%Y%m%d-%H%M%S-'), dir=backup_root))
    entries = []
    # Save every original and a manifest before touching any destination.
    for index, (path, old) in enumerate(changes):
        original = path.read_bytes()
        if digest(original) != old:
            raise ValueError('Файл изменился во время подготовки. Повтори просмотр.')
        (batch / f'{index}.bak').write_bytes(original)
        entries.append({'path': path.relative_to(root).as_posix(), 'backup': f'{index}.bak',
                        'before': old, 'after': digest(data)})
    (batch / 'manifest.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8')
    completed = []
    try:
        for entry in entries:
            path = root / entry['path']
            if digest(path.read_bytes()) != entry['before']:
                raise ValueError('Файл изменился во время операции.')
            atomic_write(path, data)
            completed.append(entry)
    except Exception:
        for entry in reversed(completed):
            atomic_write(root / entry['path'], (batch / entry['backup']).read_bytes())
        raise
    return batch


def restore(root, batch):
    entries = json.loads((batch / 'manifest.json').read_text(encoding='utf-8'))
    pending = []
    for entry in entries:
        path = inside(root / entry['path'], root)
        original = inside(batch / entry['backup'], batch).read_bytes()
        if digest(original) != entry['before']:
            raise ValueError('Резервная копия повреждена.')
        current = digest(path.read_bytes())
        if current == entry['before']:
            continue
        if current != entry['after']:
            raise ValueError(f'После замены файл редактировали. Восстановление отменено: {path}')
        pending.append((path, original))
    for path, original in pending:
        atomic_write(path, original)
    return len(pending)


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Обновление assets персонажей')
        self.geometry('1040x780')
        self.minsize(760, 560)
        self.source = tk.StringVar()
        self.relative = tk.StringVar(value=next(iter(PRESETS.values())))
        self.project = tk.StringVar(value='Все проекты')
        self.preset = tk.StringVar(value=next(iter(PRESETS)))
        self.preview = None
        self.asset_photo = None
        self.characters = sorted(p.parent for p in ROOT.glob('*/Characters/*/character-page.html'))
        top = ttk.Frame(self, padding=12)
        top.pack(fill='x')
        ttk.Label(top, text='1. Выбери персонажей слева. 2. Выбери файл и назначение. 3. Проверь замены.').pack(anchor='w')
        projects = ['Все проекты'] + sorted({p.parent.parent.name for p in self.characters})
        selector = ttk.Combobox(top, textvariable=self.project, values=projects, state='readonly')
        selector.pack(anchor='w', pady=8)
        selector.bind('<<ComboboxSelected>>', lambda _: self.populate())
        body = ttk.Panedwindow(self, orient='horizontal')
        body.pack(fill='both', expand=True, padx=12)
        left, right = ttk.Frame(body), ttk.Frame(body)
        body.add(left, weight=1)
        body.add(right, weight=3)
        ttk.Style(self).configure('Asset.Treeview', rowheight=52)
        self.listbox = ttk.Treeview(left, style='Asset.Treeview', show='tree', selectmode='extended', height=18)
        scroll = ttk.Scrollbar(left, command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scroll.set)
        self.listbox.pack(side='left', fill='both', expand=True)
        scroll.pack(side='right', fill='y')
        self.listbox.bind('<<TreeviewSelect>>', lambda _: self.on_target_change())
        self.listbox.bind('<Shift-Button-1>', self.toggle_shift_selection)
        ttk.Label(right, text='Что обновить:').pack(anchor='w')
        presets = ttk.Combobox(right, textvariable=self.preset, values=list(PRESETS), state='readonly', width=45)
        presets.pack(fill='x', pady=4)
        presets.bind('<<ComboboxSelected>>', lambda _: self.on_preset_change())
        ttk.Entry(right, textvariable=self.relative).pack(fill='x', pady=4)
        ttk.Label(right, text='Исходный файл (копируется целиком):').pack(anchor='w')
        ttk.Entry(right, textvariable=self.source).pack(fill='x', pady=4)
        ttk.Button(right, text='Выбрать файл…', command=self.choose).pack(anchor='w')
        preview_box = ttk.LabelFrame(right, text='Current asset', padding=8)
        preview_box.pack(fill='x', pady=(10, 2))
        self.asset_preview = ttk.Label(preview_box, text='Select a character to preview its current asset.', anchor='center')
        self.asset_preview.pack(fill='x')
        self.asset_preview_path = ttk.Label(preview_box, text='', justify='left', wraplength=470)
        self.asset_preview_path.pack(fill='x', pady=(6, 0))
        self.output = tk.Text(right, wrap='word', state='disabled', height=20)
        self.output.pack(fill='both', expand=True, pady=8)
        bottom = ttk.Frame(self, padding=12)
        bottom.pack(fill='x', before=body)
        ttk.Button(bottom, text='Выбрать всех в списке', command=self.select_all).pack(side='left')
        ttk.Button(bottom, text='Показать замены', command=self.show_plan).pack(side='left', padx=8)
        self.apply_button = ttk.Button(bottom, text='Применить', command=self.commit, state='disabled')
        self.apply_button.pack(side='left')
        ttk.Button(bottom, text='Восстановить копию…', command=self.undo).pack(side='right')
        self.source.trace_add('write', lambda *_: self.invalidate())
        self.relative.trace_add('write', lambda *_: self.on_relative_change())
        self.populate()

    def invalidate(self):
        self.preview = None
        self.apply_button.configure(state='disabled')

    def on_target_change(self):
        self.invalidate()
        self.refresh_asset_preview()

    def toggle_shift_selection(self, event):
        """Use Shift-click to toggle individual rows instead of selecting a range."""
        item = self.listbox.identify_row(event.y)
        if not item:
            return 'break'
        selected = set(self.listbox.selection())
        if item in selected:
            self.listbox.selection_remove(item)
        else:
            self.listbox.selection_add(item)
            self.listbox.focus(item)
        return 'break'

    def on_preset_change(self):
        self.relative.set(PRESETS[self.preset.get()])

    def on_relative_change(self):
        self.invalidate()
        self.refresh_character_thumbnails()
        self.refresh_asset_preview()

    def refresh_asset_preview(self):
        selected = self.listbox.selection()
        self.asset_photo = None
        if not selected:
            self.asset_preview.configure(image='', text='Select a character to preview its current asset.')
            self.asset_preview_path.configure(text='')
            return

        relative = Path(self.relative.get())
        target = self.visible[int(selected[0])] / relative
        extra = f'  (+{len(selected) - 1} selected)' if len(selected) > 1 else ''
        self.asset_preview_path.configure(text=f'{self.visible[selected[0]].name} / {relative.as_posix()}{extra}')
        if target.suffix.lower() not in IMAGE_SUFFIXES:
            self.asset_preview.configure(image='', text='Preview is available for image files only.')
            return
        if not target.is_file():
            self.asset_preview.configure(image='', text='This character does not have this file yet.')
            return
        try:
            from PIL import Image, ImageOps, ImageTk
            with Image.open(target) as image:
                image.seek(0)
                image = ImageOps.exif_transpose(image).convert('RGBA')
                image.thumbnail((360, 180))
                self.asset_photo = ImageTk.PhotoImage(image)
            self.asset_preview.configure(image=self.asset_photo, text='')
        except Exception as exc:
            self.asset_preview.configure(image='', text=f'Could not preview this image: {exc}')

    def refresh_character_thumbnails(self):
        self.asset_thumbnails = {}
        relative = Path(self.relative.get())
        if relative.suffix.lower() not in IMAGE_SUFFIXES:
            for item in self.listbox.get_children():
                self.listbox.item(item, image='')
            return
        try:
            from PIL import Image, ImageOps, ImageTk
            for index, character in enumerate(self.visible):
                target = character / relative
                if not target.is_file():
                    self.listbox.item(str(index), image='')
                    continue
                with Image.open(target) as image:
                    image.seek(0)
                    image = ImageOps.exif_transpose(image).convert('RGBA')
                    image.thumbnail((44, 44))
                    thumbnail = ImageTk.PhotoImage(image)
                self.asset_thumbnails[str(index)] = thumbnail
                self.listbox.item(str(index), image=thumbnail)
        except Exception:
            # The larger preview reports image errors for the selected character.
            pass

    def populate(self):
        self.visible = [p for p in self.characters if self.project.get() == 'Все проекты' or p.parent.parent.name == self.project.get()]
        for item in self.listbox.get_children():
            self.listbox.delete(item)
        for index, path in enumerate(self.visible):
            self.listbox.insert('', 'end', iid=str(index), text=f'{path.parent.parent.name} / {path.name}')
        self.invalidate()
        self.refresh_character_thumbnails()
        self.refresh_asset_preview()

    def select_all(self):
        self.listbox.selection_set(self.listbox.get_children())
        self.on_target_change()

    def choose(self):
        path = filedialog.askopenfilename(title='Файл для копирования')
        if path:
            self.source.set(path)

    def log(self, text):
        self.output.configure(state='normal')
        self.output.delete('1.0', 'end')
        self.output.insert('end', text)
        self.output.configure(state='disabled')

    def show_plan(self):
        self.invalidate()
        try:
            selected = [self.visible[int(i)] for i in self.listbox.selection()]
            if not selected:
                raise ValueError('Выбери хотя бы одного персонажа.')
            self.preview = plan(ROOT, selected, self.relative.get(), Path(self.source.get()))
            data, rows = self.preview
            extension = Path(self.relative.get()).suffix.lower()
            note = ''
            if extension == '.png':
                note = 'Результат: PNG\n\n'
            elif extension == '.gif':
                note = 'Результат: GIF, анимация сохраняется\n\n'
            self.log(note + '\n'.join(f'{action}: {p.relative_to(ROOT)}' for p, _, action in rows))
            if any(action == 'Заменить' for _, _, action in rows):
                self.apply_button.configure(state='normal')
        except Exception as exc:
            messagebox.showerror('Не удалось подготовить', str(exc))

    def commit(self):
        if not self.preview:
            return
        data, rows = self.preview
        try:
            batch = apply(ROOT, BACKUPS, data, rows)
            self.log(f'Готово. Резервная копия:\n{batch}')
        except Exception as exc:
            messagebox.showerror('Замена не завершена', str(exc))
        finally:
            self.invalidate()

    def undo(self):
        path = filedialog.askopenfilename(title='Выбери manifest.json резервной копии', initialdir=BACKUPS, filetypes=[('Manifest', 'manifest.json')])
        if not path:
            return
        try:
            batch = inside(Path(path).parent, BACKUPS)
            if not messagebox.askyesno('Восстановление', f'Восстановить файлы из {batch.name}?'):
                return
            count = restore(ROOT, batch)
            self.log(f'Восстановлено файлов: {count}')
            self.invalidate()
        except Exception as exc:
            messagebox.showerror('Восстановление не выполнено', str(exc))


if __name__ == '__main__':
    App().mainloop()
