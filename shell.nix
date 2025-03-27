{ pkgs ? import <nixpkgs> {} }:

let
  venvDir = "./.venv";
in pkgs.mkShell {
  nativeBuildInputs = with pkgs.buildPackages; [
    ncurses
    openssh
    git
    corepack_22
    nodejs_22
    uv
  ];

  packages = [
    (pkgs.python3.withPackages (python-pkgs: [
      python-pkgs.pytest
    ]))
  ];

  shellHook = ''
    if [ ! -d "${venvDir}" ]; then
      echo "Installing python dependencies"

      printf "Creating virtual environment...\n"
      uv venv --python 3.12 ${venvDir}
      source "${venvDir}/bin/activate"

      if [ -f "requirements.txt" ]; then
        printf "Installing dependencies...\n"
        uv pip install -r requirements.txt
      fi
    fi

    source "${venvDir}/bin/activate"
    export PYTHONPATH="$PWD:$PYTHONPATH"
  '';
}
