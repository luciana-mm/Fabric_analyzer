import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function CreateAccountPage({
    aberto, isClosed
}) {
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false)

    const [senha, setSenha] = useState("")
    const [confirmarSenha, setConfirmarSenha] = useState("")
    const senhasIguais = senha === confirmarSenha

    const [idSalvo, setIdSalvo] = useState('')
    const [nomeSalvo, setNomeSalvo] = useState('')
    const [emailSalvo, setEamilSalvo] = useState('')

    const [savedField, setSavedField] = useState([])
    const [erros, setErros] = useState({
        id: "",
        nome: "",
        email: "",
        senha: "",
        confirmarSenha: "",
    })


    function handleClick() {
        const novosErros = {
            id: "",
            nome: "",
            email: "",
            senha: "",
            confirmarSenha: "",
        }

        if (idSalvo.trim() === "") {
            novosErros.id = "ID é obrigatório"
        }

        if (nomeSalvo.trim() === "") {
            novosErros.nome = "Nome é obrigatório"
        }

        if (emailSalvo.trim() === "") {
            novosErros.email = "Email é obrigatório"
        }

        if (senha.trim() === "") {
            novosErros.senha = "Senha é obrigatória"
        }

        if (confirmarSenha.trim() === "") {
            novosErros.confirmarSenha = "Confirme sua senha"
        }

        if (senha && confirmarSenha && !senhasIguais) {
            novosErros.confirmarSenha = "As senhas precisam ser iguais"
        }

        setErros(novosErros)

        const temErro = Object.values(novosErros).some((erro) => erro !== "")


        if (temErro) {
            return
        }

        const camposSalvos = {
            id: idSalvo,
            nome: nomeSalvo,
            email: emailSalvo,
            senha: senha,
        }

        setSavedField([...savedField, camposSalvos])

        setIdSalvo("")
        setNomeSalvo("")
        setEamilSalvo("")
        setSenha("")
        setConfirmarSenha("")

        setErros({
            id: "",
            nome: "",
            email: "",
            senha: "",
            confirmarSenha: "",
        })
    }

    console.log('id:' + idSalvo + 'nome' + nomeSalvo + 'email' + emailSalvo)

    if (!aberto) return null

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
        >
            <div className="w-full max-w-lg rounded-xl bg-[#0a0c14] p-6 text-white shadow-lg flex flex-col gap-4">
                <div className="grid grid-cols-1">
                    <button
                        className="place-self-end font-bold rounded-[100px] w-[30px] h-[30px] border-[2px] border-white"
                        onClick={isClosed}
                    >
                        X
                    </button>
                    <h1 className="place-self-center text-lg">Adicionar novo operador</h1>
                </div>
                <div className="flex flex-col gap-7 mt-6 mb-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                            ID Funcionario
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: 2222"
                            value={idSalvo}
                            onChange={(e) => setIdSalvo(e.target.value)}
                            className="w-full rounded-[5px] p-3 text-sm bg-slate-800/50 shadow-sm shadow-white/20 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                            required
                        />
                        {erros.id && (
                            <p className="text-xs text-red-400">{erros.id}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: João da Silva"
                            value={nomeSalvo}
                            onChange={(e) => setNomeSalvo(e.target.value)}
                            className="w-full rounded-[5px] p-3 text-sm bg-slate-800/50 shadow-sm shadow-white/20 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                            required
                        />
                        {erros.nome && (
                            <p className="text-xs text-red-400">{erros.nome}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="joao@empresa.com"
                            value={emailSalvo}
                            onChange={(e) => setEamilSalvo(e.target.value)}
                            className="w-full rounded-[5px] p-3 text-sm bg-slate-800/50 shadow-sm shadow-white/20 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                            required
                        />
                        {erros.email && (
                            <p className="text-xs text-red-400">{erros.email}</p>
                        )}
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                            Senha
                        </label>
                        <input
                            type={mostrarSenha ? "text" : "password"}
                            placeholder="••••••••"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            className="w-full rounded-[5px] p-3 text-sm bg-slate-800/50 shadow-sm shadow-white/20 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                            required
                        />
                        {erros.senha && (
                            <p className="text-xs text-red-400">{erros.senha}</p>
                        )}
                        <button
                            onClick={() => setMostrarSenha(!mostrarSenha)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50"
                        >
                            {mostrarSenha ? <EyeOff /> : <Eye />}
                        </button>
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">
                            Confirmar senha
                        </label>
                        <input
                            type={mostrarConfirmarSenha ? "text" : "password"}
                            value={confirmarSenha}
                            onChange={(e) => setConfirmarSenha(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-[5px] p-3 text-sm bg-slate-800/50 shadow-sm shadow-white/20 border border-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                            required
                        />
                        <button
                            onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50"
                        >
                            {mostrarConfirmarSenha ? <EyeOff /> : <Eye />}
                        </button>
                        {erros.confirmarSenha && (
                            <p className="text-xs text-red-400">{erros.confirmarSenha}</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-between">
                    <button
                        onClick={isClosed}
                        className="bg-slate-800/50 p-3 px-6 hover:bg-slate-700 rounded-lg text-xs col-start-1 border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15"
                    >
                        Fechar
                    </button>
                    <button
                        onClick={() => handleClick()}
                        className="bg-slate-800/50 hover:bg-slate-700 p-3 px-6 rounded-lg text-xs col-start-1 border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15 "
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    )
}