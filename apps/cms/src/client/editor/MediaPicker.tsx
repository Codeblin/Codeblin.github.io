import { useRef, type ChangeEvent, type ReactElement } from 'react';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const VIDEO_EXT = /\.mp4$/i;

export type MediaKindFilter = 'image' | 'video';

export interface MediaPickerProps {
  files: string[];
  accept: MediaKindFilter;
  value: string;
  onChange: (src: string) => void;
  onUpload?: (file: File) => Promise<string>;
  label?: string;
  allowEmpty?: boolean;
}

function toSrc(filename: string): string {
  return filename.startsWith('./media/') ? filename : `./media/${filename}`;
}

function filename(src: string): string {
  return src.replace(/^\.\/media\//, '');
}

export function filterMedia(files: string[], accept: MediaKindFilter): string[] {
  const pattern = accept === 'image' ? IMAGE_EXT : VIDEO_EXT;
  return files.filter((file) => pattern.test(file));
}

export function MediaPicker({
  files,
  accept,
  value,
  onChange,
  onUpload,
  label = 'File',
  allowEmpty = false,
}: MediaPickerProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const options = filterMedia(files, accept).map(toSrc);
  if (value && !options.includes(value) && !value.startsWith('youtube:')) options.unshift(value);
  const empty = options.length === 0;

  const onFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUpload) return;
    void onUpload(file)
      .then((src) => onChange(src))
      .catch(() => {
        /* toast is handled by the editor's upload wrapper */
      });
  };

  return (
    <div className="form-row">
      <label style={{ flex: 1 }}>
        {label}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {(empty || allowEmpty || !value) && (
            <option value="">{empty ? `No ${accept}s uploaded yet` : 'None'}</option>
          )}
          {options.map((src) => (
            <option key={src} value={src}>
              {filename(src)}
            </option>
          ))}
        </select>
      </label>
      {onUpload && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              input.current?.click();
            }}
          >
            Upload
          </button>
          <input
            ref={input}
            type="file"
            accept={accept === 'image' ? 'image/png,image/jpeg,image/webp,image/gif,image/avif' : 'video/mp4'}
            hidden
            onChange={onFile}
            onClick={(event) => event.stopPropagation()}
          />
        </>
      )}
    </div>
  );
}
