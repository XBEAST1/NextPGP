"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const Page = () => {
  const router = useRouter();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenWelcome");
    setShowButton(!hasSeen);
  }, []);

  const EnterNextPGP = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center">
      <div className="sm:max-w-[95vw] max-w-7xl w-full">
        <motion.h1
          {...fadeInUp}
          className="text-4xl font-bold mb-6 text-center"
        >
          Welcome to Next PGP 🖤✨
        </motion.h1>

        <motion.div
          {...fadeInUp}
          className="bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl shadow-xl space-y-6"
        >
          <p className="text-lg">
            NextPGP helps you send secret messages/files that only the right
            person can open and read.
          </p>

          <h2 className="text-2xl font-semibold">🔐 What is PGP?</h2>
          <p>
            PGP stands for{" "}
            <span className="font-bold">Pretty Good Privacy</span>. It&apos;s an
            asymmetric encryption system that locks your messages so only the
            intended recipient can unlock and read them.
          </p>

          <h2 className="text-2xl font-semibold">🗝️ How does it work?</h2>
          <p>PGP uses two special keys:</p>

          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="list-disc ps-4 space-y-2 mt-2"
          >
            <motion.li variants={listItem} className="ps-1">
              <strong>Public key</strong>{" "}
              <span className="text-gray-400">
                (silver key{" "}
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block"
                >
                  🗝️
                </motion.span>
                )
              </span>
              : You share this with anyone. They use it to lock a message for
              you.
            </motion.li>
            <motion.li variants={listItem} className="ps-1">
              <strong>Private key</strong>{" "}
              <span className="text-yellow-400">
                (golden key{" "}
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block"
                >
                  🔑
                </motion.span>
                )
              </span>
              : You keep this secret. You use it to unlock the message.
            </motion.li>
          </motion.ul>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70 }}
            className="bg-gray-200 dark:bg-gray-800 text-black dark:text-white p-4 rounded-xl mt-4"
          >
            <h3 className="text-xl font-semibold mb-2">
              👥 Example: Hamza & Daniela
            </h3>
            <p className="mb-4">
              Hamza and Daniela both want to talk securely using PGP.
            </p>
            <ul className="list-disc ps-4 space-y-1">
              <li className="ps-1">
                First, they each open NextPGP and generate their own key pair —
                a <strong>public key</strong>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  (silver key 🗝️)
                </span>{" "}
                and a <strong>private key</strong>{" "}
                <span className="text-yellow-600 dark:text-yellow-400">
                  (golden key 🔑)
                </span>
                .
              </li>
              <li className="ps-1">
                Daniela sends her <strong>public key</strong>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  (silver key 🗝️)
                </span>{" "}
                to Hamza, and Hamza does the same — he sends his{" "}
                <strong>public key</strong>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  (silver key 🗝️)
                </span>{" "}
                to Daniela. It&apos;s safe to share these because they&apos;re
                only used to <strong>lock (encrypt)</strong> messages.
              </li>
              <li className="ps-1">
                Hamza writes: “Hey Daniela, here&apos;s the secret!” and uses
                her <strong>public key</strong>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  (silver key 🗝️)
                </span>{" "}
                to <strong>lock (encrypt)</strong> the message.
              </li>
              <li className="ps-1">
                Daniela receives the locked message and uses her{" "}
                <strong>private key</strong>{" "}
                <span className="text-yellow-600 dark:text-yellow-400">
                  (golden key 🔑)
                </span>{" "}
                to <strong>unlock (decrypt)</strong> it.
              </li>
              <li className="ps-1">
                Even if someone intercepts the message, they can&apos;t read it
                without Daniela&apos;s <strong>private key</strong>{" "}
                <span className="text-yellow-600 dark:text-yellow-400">
                  (golden key 🔑)
                </span>
                .
              </li>
              <li className="ps-1">
                To reply, Daniela does the same: she uses Hamza&apos;s{" "}
                <strong>public key</strong>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  (silver key 🗝️)
                </span>{" "}
                to <strong>lock (encrypt)</strong> a message that only he can{" "}
                <strong>unlock (decrypt)</strong> with his{" "}
                <strong>private key</strong>{" "}
                <span className="text-yellow-600 dark:text-yellow-400">
                  (golden key 🔑)
                </span>
                .
              </li>
            </ul>
          </motion.div>

          <h2 className="text-2xl font-semibold mt-6">🛡️ Why should I care?</h2>
          <motion.ul
            variants={listVariants}
            initial="hidden"
            whileInView="visible"
            className="list-disc ps-4 space-y-2 mt-2"
          >
            {[
              "It keeps your private stuff truly private — no one (not even hackers or governments) can spy on your messages.",
              "You can prove a message really came from you using the signature — no fakes or impersonators.",
              "PGP works for messages, files, and even emails — it's like a security shield across all communication.",
              "You're in control. Only you hold the golden key. No one else.",
            ].map((text, i) => (
              <motion.li key={i} variants={listItem} className="ps-1">
                {text}
              </motion.li>
            ))}
          </motion.ul>

          <h2 className="text-2xl font-semibold">
            🚀 What can I do with Next PGP?
          </h2>
          <motion.ul
            variants={listVariants}
            initial="hidden"
            whileInView="visible"
            className="list-disc ps-4 space-y-2 mt-2"
          >
            {[
              "Encrypt messages so only the right person can read them.",
              "Decrypt messages sent to you.",
              "Share and protect files using encryption.",
              "Manage your keys — safely and easily.",
            ].map((text, i) => (
              <motion.li key={i} variants={listItem} className="ps-1">
                {text}
              </motion.li>
            ))}
          </motion.ul>

          <motion.div {...fadeInUp} className="text-center mt-8 space-y-4">
            <p className="text-base text-gray-400 mb-4">
              Private by design — only you control your data 🛡️
            </p>
          </motion.div>

          {showButton && (
            <motion.div {...fadeInUp} className="text-center mt-8 space-y-4">
              <Link href="/" passHref>
                <Button
                  onPress={EnterNextPGP}
                  className="text-base font-medium px-6 py-2 rounded-xl"
                >
                  Enter Next PGP 🔓
                </Button>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Page;
