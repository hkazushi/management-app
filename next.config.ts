import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 個人用1ユーザーアプリ。設定は最小限から始める。
  // 一度開いた画面は、しばらく手元の控えをそのまま出す（タブを切り替えるたびに取り直さない）。
  // 追加・削除などをしたときは revalidatePath で控えが捨てられるので、自分の操作はすぐ反映される。
  // 相手が入れた分は、最大でこの秒数だけ遅れて見える。
  experimental: {
    staleTimes: { dynamic: 60, static: 60 },
  },
};

export default nextConfig;
