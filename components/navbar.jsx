"use client";

import React from "react";
import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  DropdownItem,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
} from "@nextui-org/react";
import { useState } from "react";
import { Button, Link } from "@nextui-org/react";
import NextLink from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { GithubIcon, HeartFilledIcon } from "@/components/icons";
import Logo from "@/assets/Logo.png";
import LogoLight from "@/assets/Logo-Light.png";
import { useTheme } from "next-themes";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useReducer(
    (current) => !current,
    false
  );

  const menuItems = [
    { label: "Manage Keyrings", href: "/" },
    { label: "Generate Keyring", href: "/generate" },
    { label: "Import Key", href: "/import" },
    { label: "Encrypt", href: "/encrypt" },
    { label: "Decrypt", href: "/decrypt" },
    { label: "Open Source", href: "https://github.com/XBEAST1/NextPGP" },
  ];

  return (
    <NextUINavbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      className="p-7 backdrop-blur backdrop-brightness-200"
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent
        className="basis-1/5 sm:basis-full mx-[-1.5rem]"
        justify="start"
      >
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            {(() => {
              const { theme } = useTheme();
              return (
                <img
                  width={70}
                  src={theme === "light" ? LogoLight.src : Logo.src}
                  alt="Logo"
                />
              );
            })()}
            <p className="font-bold text-inherit">Next PGP</p>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <Dropdown>
          <NavbarItem>
            <DropdownTrigger>
              <Button size="md">Keyrings Management</Button>
            </DropdownTrigger>
          </NavbarItem>
          <DropdownMenu
            aria-label="Manage Keyrings"
            className="w-[340px]"
            itemClasses={{
              base: "gap-4",
            }}
          >
            <DropdownItem key="manage_keyrings">
              <Link className="text-decoration-none" href="/">
                <div>
                  Manage Keyrings
                  <p className="text-default-500 text-xs">
                    View, edit, or delete existing keyrings.
                  </p>
                </div>
              </Link>
            </DropdownItem>
            <DropdownItem key="generate_keyring">
              <Link className="text-decoration-none" href="/generate">
                <div>
                  Generate Keyring
                  <p className="text-default-500 text-xs">
                    Generate a new PGP keyring to securely encrypt and decrypt
                    data.
                  </p>
                </div>
              </Link>
            </DropdownItem>
            <DropdownItem key="import_key">
              <Link className="text-decoration-none" href="/import">
                <div>
                  Import Key
                  <p className="text-default-500 text-xs">
                    Import a PGP keyring to encrypt or decrypt messages.
                  </p>
                </div>
              </Link>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <Dropdown>
          <NavbarItem>
            <DropdownTrigger>
              <Button size="md">Encryption / Decryption</Button>
            </DropdownTrigger>
          </NavbarItem>
          <DropdownMenu
            aria-label="Encrypt or Decrypt Data"
            className="w-[340px]"
            itemClasses={{
              base: "gap-4",
            }}
          >
            <DropdownItem key="encrypt_data">
              <Link className="text-decoration-none" href="/encrypt">
                <div>
                  Encrypt
                  <p className="text-default-500 text-xs">
                    Encrypt data using a PGP public key.
                  </p>
                </div>
              </Link>
            </DropdownItem>
            <DropdownItem key="decrypt_data">
              <Link className="text-decoration-none" href="/decrypt">
                <div>
                  Decrypt
                  <p className="text-default-500 text-xs">
                    Decrypt data using a PGP private key.
                  </p>
                </div>
              </Link>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <Link
            isExternal
            aria-label="Github"
            href="https://github.com/XBEAST1"
          >
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
          <Button
            isExternal
            as={Link}
            className="text-sm font-normal text-default-600 bg-default-100"
            href="https://github.com/XBEAST1/NextPGP"
            startContent={<HeartFilledIcon className="text-danger" />}
            variant="flat"
          >
            Open Source
          </Button>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link isExternal aria-label="Github" href="https://github.com/XBEAST1">
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="sm:hidden"
        />
      </NavbarContent>
      <NavbarMenu className="mt-12 backdrop-blur">
        {menuItems.map((item, index) => (
          <NavbarMenuItem
            className="mx-auto mt-5"
            key={`${item.label}-${index}`}
          >
            <Link
              className="w-full"
              color={index === menuItems.length - 1 ? "danger" : "foreground"}
              href={item.href}
              size="lg"
              onClick={() => setIsMenuOpen()}
              target={item.href.startsWith("http") ? "_blank" : undefined}
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </NextUINavbar>
  );
};