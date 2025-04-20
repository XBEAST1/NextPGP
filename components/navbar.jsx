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
  Button,
  Link,
} from "@heroui/react";
import NextLink from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { HeartFilledIcon } from "@/components/icons";
import Logo from "@/assets/Logo.png";
import LogoLight from "@/assets/Logo-Light.png";
import { useTheme } from "next-themes";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useReducer(
    (current) => !current,
    false
  );

  const { theme } = useTheme();

  const menuItems = [
    { label: "Manage Keyrings", href: "/" },
    { label: "Generate Keyring", href: "/generate" },
    { label: "Import Key", href: "/import" },
    { label: "Encrypt", href: "/encrypt" },
    { label: "Decrypt", href: "/decrypt" },
    { label: "Cloud Backup", href: "/cloud-backup" },
    { label: "Cloud Manage", href: "/cloud-manage" },
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
        className="basis-1/5 lg:basis-full mx-[-1.5rem]"
        justify="start"
      >
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <img
              width={70}
              src={theme === "light" ? LogoLight.src : Logo.src}
              alt="Logo"
            />
            <p className="font-bold text-inherit">Next PGP</p>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden lg:flex gap-4 ms-12" justify="center">
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
            <DropdownItem textValue="Manage Keyrings">
              <NextLink className="text-decoration-none" href="/">
                <div>
                  Manage Keyrings
                  <p className="text-default-500 text-xs">
                    View, edit, or delete existing keyrings.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
            <DropdownItem textValue="Generate Keyrings">
              <NextLink className="text-decoration-none" href="/generate">
                <div>
                  Generate Keyring
                  <p className="text-default-500 text-xs">
                    Generate a new PGP keyring to securely encrypt and decrypt
                    data.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
            <DropdownItem textValue="Import Key">
              <NextLink className="text-decoration-none" href="/import">
                <div>
                  Import Key
                  <p className="text-default-500 text-xs">
                    Import a PGP keyring to encrypt or decrypt messages.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      <NavbarContent className="hidden lg:flex gap-4" justify="center">
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
            <DropdownItem textValue="Encrypt">
              <NextLink className="text-decoration-none" href="/encrypt">
                <div>
                  Encrypt
                  <p className="text-default-500 text-xs">
                    Encrypt data using a PGP public key.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
            <DropdownItem textValue="Decrypt">
              <NextLink className="text-decoration-none" href="/decrypt">
                <div>
                  Decrypt
                  <p className="text-default-500 text-xs">
                    Decrypt data using a PGP private key.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      <NavbarContent className="hidden lg:flex gap-4" justify="center">
        <Dropdown>
          <NavbarItem>
            <DropdownTrigger>
              <Button size="md">Cloud Keys Management</Button>
            </DropdownTrigger>
          </NavbarItem>
          <DropdownMenu
            aria-label="Encrypt or Decrypt Data"
            className="w-[340px]"
            itemClasses={{
              base: "gap-4",
            }}
          >
            <DropdownItem textValue="Backup">
              <NextLink className="text-decoration-none" href="/cloud-backup">
                <div>
                  Backup Keyrings
                  <p className="text-default-500 text-xs">
                    Backip PGP keys on cloud storage.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
            <DropdownItem textValue="Import">
              <NextLink className="text-decoration-none" href="/cloud-manage">
                <div>
                  Manage Keyrings
                  <p className="text-default-500 text-xs">
                    View, import, or delete keyrings on cloud.
                  </p>
                </div>
              </NextLink>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      <NavbarContent
        className="hidden lg:flex basis-1/5 lg:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden lg:flex gap-2">
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
      <NavbarContent className="lg:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden"
        />
      </NavbarContent>
      <NavbarMenu className="mt-12 backdrop-blur">
        {menuItems.map((item, index) => (
          <NavbarMenuItem
            className="mx-auto mt-5"
            key={`${item.label}-${index}`}
          >
            <NextLink
              className={`w-full ${index === menuItems.length - 1 ? "text-danger" : "text-foreground"}`}
              href={item.href}
              size="lg"
              onClick={() => setIsMenuOpen()}
              target={item.href.startsWith("http") ? "_blank" : undefined}
            >
              {item.label}
            </NextLink>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </NextUINavbar>
  );
};
