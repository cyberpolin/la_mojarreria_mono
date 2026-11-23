import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Hint, Label } from "@/components/Typography";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { Header } from "./WrapperComponents";
import { CLOSE_EVIDENCE_SLOTS, upsertCloseEvidence } from "./closeEvidence";
import { CloseEvidencePhoto } from "./Types";

type Props = {
  photos: CloseEvidencePhoto[];
  onChange: (photos: CloseEvidencePhoto[]) => void;
  onContinue: () => void;
};

export default function PortraitCloseEvidenceStep({
  photos,
  onChange,
  onContinue,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stepIndex, setStepIndex] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const slot = CLOSE_EVIDENCE_SLOTS[stepIndex];
  const currentPhoto = photos.find((item) => item.kind === slot.kind);
  const isLast = stepIndex === CLOSE_EVIDENCE_SLOTS.length - 1;
  const stepLabel = `Paso ${stepIndex + 1} de ${CLOSE_EVIDENCE_SLOTS.length}`;

  const StepFooter = ({ light = false }: { light?: boolean }) => (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: light ? "#334155" : "#e2e8f0",
        alignItems: "center",
      }}
    >
      <Label
        style={{
          color: light ? "#ffffff" : "#334155",
          fontSize: 14,
        }}
      >
        {stepLabel}
      </Label>
      <Hint style={{ color: light ? "#cbd5e1" : "#64748b", marginTop: 2 }}>
        {slot.label}
      </Hint>
    </View>
  );

  const openCamera = async () => {
    setCameraError(null);
    setPreviewUri(null);

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setCameraError("Necesitas permitir la cámara para tomar evidencias.");
        return;
      }
    }

    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
    setPreviewUri(null);
    setIsCapturing(false);
  };

  const takePhoto = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setCameraError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.55,
        skipProcessing: true,
      });
      if (!photo?.uri) {
        setCameraError("No se pudo tomar la foto. Intenta de nuevo.");
        return;
      }
      setPreviewUri(photo.uri);
    } catch {
      setCameraError("No se pudo tomar la foto. Intenta de nuevo.");
    } finally {
      setIsCapturing(false);
    }
  };

  const goToNext = (nextPhotos: CloseEvidencePhoto[]) => {
    if (isLast) {
      onChange(nextPhotos);
      onContinue();
      return;
    }
    onChange(nextPhotos);
    setStepIndex((index) => index + 1);
  };

  const confirmPhoto = () => {
    const uri = previewUri ?? currentPhoto?.localUri;
    if (!uri) return;
    const nextPhotos = upsertCloseEvidence(photos, {
      kind: slot.kind,
      localUri: uri,
      takenAt: new Date().toISOString(),
    });
    closeCamera();
    goToNext(nextPhotos);
  };

  if (isCameraOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={{ flex: 1 }} />
        ) : (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            mode="picture"
            mute
          />
        )}

        <View
          style={{
            position: "absolute",
            top: 48,
            left: 20,
            right: 20,
          }}
        >
          <Label style={{ color: "#ffffff", fontSize: 20 }}>{slot.label}</Label>
          <Hint style={{ color: "#e2e8f0", marginTop: 6 }}>
            {slot.instruction}
          </Hint>
        </View>

        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 8 }}>
            {previewUri ? (
              <>
                <PrimaryButton onPress={confirmPhoto}>Usar foto</PrimaryButton>
                <SecondaryButton
                  onPress={() => setPreviewUri(null)}
                  textStyle={{ color: "#ffffff" }}
                >
                  Repetir
                </SecondaryButton>
              </>
            ) : (
              <>
                <Pressable
                  onPress={takePhoto}
                  disabled={isCapturing}
                  style={({ pressed }) => ({
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: pressed ? "#e2e8f0" : "#ffffff",
                    borderWidth: 4,
                    borderColor: "#94a3b8",
                    opacity: isCapturing ? 0.5 : 1,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  {isCapturing ? <ActivityIndicator color="#0f172a" /> : null}
                </Pressable>
                <SecondaryButton
                  onPress={closeCamera}
                  textStyle={{ color: "#ffffff" }}
                >
                  Cancelar
                </SecondaryButton>
              </>
            )}
          </View>
          <StepFooter light />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <Header compact title={slot.label} subtitle="Evidencias del cierre" />
        <Label style={{ lineHeight: 24 }}>{slot.instruction}</Label>

        {cameraError ? (
          <Hint style={{ marginTop: 12, color: "#7f1d1d" }}>{cameraError}</Hint>
        ) : null}

        {permission && !permission.granted && !permission.canAskAgain ? (
          <SecondaryButton onPress={() => Linking.openSettings()}>
            Abrir ajustes
          </SecondaryButton>
        ) : null}

        {currentPhoto ? (
          <Image
            source={{ uri: currentPhoto.localUri }}
            style={{
              width: "100%",
              height: 220,
              borderRadius: 12,
              marginTop: 20,
              backgroundColor: "#e2e8f0",
            }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 220,
              borderRadius: 12,
              marginTop: 20,
              backgroundColor: "#f1f5f9",
              borderWidth: 1,
              borderColor: "#cbd5e1",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
            }}
          >
            <Hint style={{ textAlign: "center" }}>
              Toma la foto con la cámara. No se puede elegir de la galería.
            </Hint>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <PrimaryButton onPress={currentPhoto ? confirmPhoto : openCamera}>
            {currentPhoto ? "Continuar" : "Tomar foto"}
          </PrimaryButton>
          {currentPhoto ? (
            <SecondaryButton onPress={openCamera}>
              Volver a tomar
            </SecondaryButton>
          ) : null}
          {stepIndex > 0 ? (
            <SecondaryButton onPress={() => setStepIndex((index) => index - 1)}>
              Atrás
            </SecondaryButton>
          ) : null}
        </View>
      </View>
      <StepFooter />
    </View>
  );
}
