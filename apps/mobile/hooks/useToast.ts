import Toast from "react-native-toast-message";

enum ToastType {
  SUCCESS = "success",
  ERROR = "error",
  INFO = "info",
}

type ToastProps = (title: string, description?: string) => void;

const useToast = () => {
  const showError: ToastProps = (title, description) =>
    Toast.show({
      type: ToastType.ERROR,
      text1: title,
      text2: description || undefined,
    });

  const showWarning: ToastProps = (title, description) =>
    Toast.show({
      type: ToastType.INFO,
      text1: title,
      text2: description || undefined,
    });

  const showInfo: ToastProps = (title, description) =>
    Toast.show({
      type: ToastType.INFO,
      text1: title,
      text2: description || undefined,
    });

  return {
    showError,
    showWarning,
    showInfo,
  };
};

export default useToast;
