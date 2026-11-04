import tempfile
import unittest
from pathlib import Path
from updater import plan, apply, restore
from updater import to_png
from PIL import Image
import io


class Updates(unittest.TestCase):
    def test_animated_gif_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            character = root / 'Project/Characters/A'
            target = character / 'assets/images/06_playlist-background.gif'
            target.parent.mkdir(parents=True)
            Image.new('RGB', (8, 8), 'black').save(target, format='GIF')
            original = target.read_bytes()
            source = root / 'animation.gif'
            Image.new('RGB', (8, 8), 'red').save(
                source, format='GIF', save_all=True,
                append_images=[Image.new('RGB', (8, 8), 'blue')],
                duration=[100, 250], loop=0)
            data, rows = plan(root, [character], 'assets/images/06_playlist-background.gif', source)
            self.assertEqual(data, source.read_bytes())
            batch = apply(root, root / 'backups', data, rows)
            self.assertEqual(target.read_bytes(), source.read_bytes())
            restore(root, batch)
            self.assertEqual(target.read_bytes(), original)
            Image.new('RGB', (8, 8)).save(source, format='PNG')
            with self.assertRaises(ValueError):
                plan(root, [character], 'assets/images/06_playlist-background.gif', source)

    def test_image_conversion(self):
        for fmt, mode in [('JPEG', 'RGB'), ('WEBP', 'RGBA'), ('BMP', 'RGB')]:
            source = io.BytesIO()
            Image.new(mode, (12, 8)).save(source, format=fmt)
            output = to_png(source.getvalue())
            with Image.open(io.BytesIO(output)) as image:
                self.assertEqual(image.format, 'PNG')
                self.assertEqual(image.size, (12, 8))
                if mode == 'RGBA':
                    self.assertEqual(image.getpixel((0, 0))[3], 0)
        source = io.BytesIO()
        image = Image.new('RGB', (12, 8))
        exif = Image.Exif()
        exif[274] = 6
        image.save(source, format='JPEG', exif=exif)
        with Image.open(io.BytesIO(to_png(source.getvalue()))) as result:
            self.assertEqual(result.size, (8, 12))
        with self.assertRaises(Exception):
            to_png(b'not an image')
        animated = io.BytesIO()
        image.save(animated, format='GIF', save_all=True,
                   append_images=[Image.new('RGB', (12, 8), 'red')])
        with self.assertRaises(ValueError):
            to_png(animated.getvalue())

    def test_copy_skip_backup_restore_and_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            characters = [root / 'Project/Characters' / name for name in ['A', 'B']]
            target = characters[0] / 'assets/data/character-colors.css'
            target.parent.mkdir(parents=True)
            target.write_bytes(b':root { --color: red; }')
            source = root / 'palette.css'
            source.write_bytes(b':root { --color: blue; }')
            data, rows = plan(root, characters, 'assets/data/character-colors.css', source)
            self.assertEqual([r[2] for r in rows], ['Заменить', 'Нет файла — пропуск'])
            batch = apply(root, root / 'backups', data, rows)
            self.assertEqual(target.read_bytes(), data)
            target.write_bytes(b'changed manually')
            with self.assertRaises(ValueError):
                restore(root, batch)
            self.assertEqual(target.read_bytes(), b'changed manually')
            target.write_bytes(data)
            self.assertEqual(restore(root, batch), 1)
            self.assertEqual(target.read_bytes(), b':root { --color: red; }')
            self.assertEqual(restore(root, batch), 0)

    def test_reject_traversal_and_stale_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            character = root / 'Project/Characters/A'
            target = character / 'assets/data/test.css'
            target.parent.mkdir(parents=True)
            target.write_bytes(b'original')
            source = root / 'test.css'
            source.write_bytes(b'new')
            with self.assertRaises(ValueError):
                plan(root, [character], 'assets/../../test.css', source)
            data, rows = plan(root, [character], 'assets/data/test.css', source)
            target.write_bytes(b'edited')
            with self.assertRaises(ValueError):
                apply(root, root / 'backups', data, rows)
            self.assertEqual(target.read_bytes(), b'edited')


if __name__ == '__main__':
    unittest.main()
