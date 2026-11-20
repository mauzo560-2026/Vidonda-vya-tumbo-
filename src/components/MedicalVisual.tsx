import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { ASSETS } from '../data/defaults';

interface MedicalVisualProps {
  imageUrl?: string;
  illustrationKey?: string;
  alt: string;
  aspectClass?: string;
}

export function MedicalVisual({
  imageUrl,
  illustrationKey,
  alt,
  aspectClass = 'aspect-[4/3]',
}: MedicalVisualProps) {
  const [imgError, setImgError] = useState(false);

  const fallbackByKey =
    illustrationKey?.startsWith('reflux_')
      ? ASSETS.acidReflux
      : illustrationKey === 'warning_signs' ||
          illustrationKey === 'ulcer_diagnosis' ||
          illustrationKey === 'ulcer_care' ||
          illustrationKey === 'reflux_lifestyle'
        ? ASSETS.medicalCheckup
        : ASSETS.stomachUlcer;

  const src = imageUrl || fallbackByKey;

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (imgError || !src) {
    return (
      <div
        className={`${aspectClass} w-full rounded-2xl bg-[#F3F7F4] border border-[#E2E9E4] flex flex-col items-center justify-center p-6 text-center`}
      >
        <div className="w-12 h-12 rounded-xl bg-[#EBF4EE] text-[#15623E] flex items-center justify-center mb-3">
          <Stethoscope className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-[#13221B] max-w-xs">{alt}</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white border border-[#E2E9E4] overflow-hidden">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        onError={() => setImgError(true)}
        className="w-full h-auto max-h-[620px] object-cover block"
      />
    </div>
  );
}
