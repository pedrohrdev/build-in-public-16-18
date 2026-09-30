import { redirect } from "next/navigation";

// Tudo agora vive numa página só; este endereço leva direto para a seção.
export default function Page() {
  redirect("/#hoje");
}
